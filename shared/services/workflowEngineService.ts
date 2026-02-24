import { Timestamp } from 'firebase/firestore';
import {
  getWorkflowInstance,
  createWorkflowInstance,
  updateWorkflowInstance,
  updateStepStatus,
  addAuditLogEntry,
} from './workflowInstanceService';
import { getWorkflowTemplate } from './workflowTemplateService';
import type { StepInstance, StepInstanceStatus, WorkflowTemplate } from '@/shared/types/workflow';

/**
 * Flattens subprocess nodes from child templates into a flat steps map.
 * Subprocess node steps are keyed as "subprocessNodeId::childNodeId".
 */
async function flattenTemplateNodes(
  tenantId: string,
  template: WorkflowTemplate
): Promise<Record<string, StepInstance>> {
  const steps: Record<string, StepInstance> = {};

  for (const node of template.nodes) {
    if (node.type === 'subprocess') {
      // Add the subprocess container step itself
      steps[node.id] = {
        nodeId: node.id,
        label: node.label || node.id,
        status: 'pending' as StepInstanceStatus,
        currentRevision: 0,
        revisions: [],
        isSubProcess: true,
      };

      // If this subprocess node has a linked child template, flatten its nodes
      const childTemplateId = node.subprocessConfig?.childTemplateId;
      if (childTemplateId) {
        const childTemplate = await getWorkflowTemplate(tenantId, childTemplateId);
        if (childTemplate) {
          for (const childNode of childTemplate.nodes) {
            const flatKey = `${node.id}::${childNode.id}`;
            steps[flatKey] = {
              nodeId: flatKey,
              label: childNode.label || childNode.id,
              status: 'pending' as StepInstanceStatus,
              currentRevision: 0,
              revisions: [],
              parentStepId: node.id,
              isSubStep: true,
            };
          }
        }
      }
    } else {
      steps[node.id] = {
        nodeId: node.id,
        label: node.label || node.id,
        status: 'pending' as StepInstanceStatus,
        currentRevision: 0,
        revisions: [],
      };
    }
  }

  return steps;
}

/**
 * Instantiates a new workflow from a template
 */
export async function instantiateWorkflow(
  tenantId: string,
  templateId: string,
  projectId: string,
  projectName: string,
  clientName: string,
  createdBy: string,
  context?: Record<string, any>
): Promise<string> {
  try {
    // Fetch the workflow template
    const template = await getWorkflowTemplate(tenantId, templateId);
    if (!template) {
      throw new Error(`Workflow template ${templateId} not found`);
    }

    // Initialize all steps, flattening subprocess nodes
    const steps = await flattenTemplateNodes(tenantId, template);

    // Find and mark the start node as completed
    const startNode = template.nodes.find(n => n.type === 'start');
    if (startNode) {
      steps[startNode.id] = {
        ...steps[startNode.id],
        status: 'completed',
        completedAt: Timestamp.now(),
      };
    }

    // Create the workflow instance via service
    const instanceId = await createWorkflowInstance(tenantId, {
      templateId,
      templateVersion: template.version,
      templateName: template.name,
      projectId,
      projectName,
      clientName,
      serviceCategory: template.serviceCategory,
      status: 'active',
      progress: 0,
      steps,
      activeNodeIds: [],
      context: context || {},
      createdBy,
    });

    // Add audit log entry
    await addAuditLogEntry(tenantId, instanceId, {
      action: 'workflow_started',
      description: `"${template.name}" is akisi "${projectName}" projesi icin baslatildi`,
      userId: createdBy,
    });

    // Advance the workflow to activate first steps
    await advanceWorkflow(tenantId, instanceId);

    return instanceId;
  } catch (error) {
    console.error('Error instantiating workflow:', error);
    throw new Error(`Failed to instantiate workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Advances the workflow by checking prerequisites and updating step statuses
 */
export async function advanceWorkflow(tenantId: string, instanceId: string): Promise<string[]> {
  try {
    // Fetch the instance and template
    const instance = await getWorkflowInstance(tenantId, instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }
    if (instance.status === 'completed' || instance.status === 'cancelled') {
      return [];
    }

    const template = await getWorkflowTemplate(tenantId, instance.templateId);
    if (!template) {
      throw new Error(`Workflow template ${instance.templateId} not found`);
    }

    let hasChanges = false;
    const updatedSteps: Record<string, StepInstance> = { ...instance.steps };

    // Process each node in the template
    for (const node of template.nodes) {
      const step = updatedSteps[node.id];
      if (!step) continue;

      // Skip if already completed or skipped
      if (step.status === 'completed' || step.status === 'skipped') {
        continue;
      }

      // Find all incoming edges
      const incomingEdges = template.edges.filter(edge => edge.target === node.id);

      // Check if all prerequisites are met
      let prerequisitesMet = true;

      if (incomingEdges.length > 0) {
        // Handle parallel_join: ALL incoming edges' source nodes must be completed
        if (node.type === 'parallel_join') {
          for (const edge of incomingEdges) {
            const sourceStep = updatedSteps[edge.source];
            if (!sourceStep || (sourceStep.status !== 'completed' && sourceStep.status !== 'skipped')) {
              prerequisitesMet = false;
              break;
            }
          }
        }
        // Handle condition: evaluate condition and check appropriate path
        else if (node.type === 'condition') {
          // Check if the incoming edge's source is completed
          for (const edge of incomingEdges) {
            const sourceStep = updatedSteps[edge.source];
            if (!sourceStep || (sourceStep.status !== 'completed' && sourceStep.status !== 'skipped')) {
              prerequisitesMet = false;
              break;
            }
          }

          // If prerequisites are met, evaluate the condition
          if (prerequisitesMet && node.conditionConfig) {
            const conditionResult = evaluateCondition(node.conditionConfig, instance.context);

            // Find outgoing edges
            const outgoingEdges = template.edges.filter(edge => edge.source === node.id);

            // Mark the condition node as completed based on evaluation
            if (step.status === 'pending') {
              updatedSteps[node.id] = {
                ...step,
                status: 'completed',
                completedAt: Timestamp.now(),
                outputData: { conditionResult },
              };
              hasChanges = true;
            }

            // Skip nodes on the non-selected path
            for (const outgoingEdge of outgoingEdges) {
              const shouldFollow = outgoingEdge.conditionValue === conditionResult.toString();

              if (!shouldFollow) {
                const targetStep = updatedSteps[outgoingEdge.target];
                if (targetStep && targetStep.status === 'pending') {
                  updatedSteps[outgoingEdge.target] = {
                    ...targetStep,
                    status: 'skipped',
                  };
                  hasChanges = true;
                }
              }
            }

            continue;
          }
        }
        // Handle regular nodes: check if all incoming edges' sources are completed
        else {
          for (const edge of incomingEdges) {
            const sourceStep = updatedSteps[edge.source];
            if (!sourceStep || (sourceStep.status !== 'completed' && sourceStep.status !== 'skipped')) {
              prerequisitesMet = false;
              break;
            }
          }
        }
      }

      // If prerequisites are met and step is pending, set it to ready
      if (prerequisitesMet && step.status === 'pending') {
        updatedSteps[node.id] = {
          ...step,
          status: 'ready',
        };
        hasChanges = true;
      }

      // Auto-complete parallel_join nodes if all prerequisites are met
      if (prerequisitesMet && (step.status === 'ready' || updatedSteps[node.id].status === 'ready') && node.type === 'parallel_join') {
        updatedSteps[node.id] = {
          ...updatedSteps[node.id],
          status: 'completed',
          completedAt: Timestamp.now(),
        };
        hasChanges = true;
      }

      // Auto-complete subprocess node when all its child sub-steps are completed
      if (node.type === 'subprocess' && (step.status === 'ready' || step.status === 'in_progress')) {
        const childSteps = Object.values(updatedSteps).filter(
          (s) => s.isSubStep && s.parentStepId === node.id
        );
        if (childSteps.length > 0) {
          const allChildrenDone = childSteps.every(
            (s) => s.status === 'completed' || s.status === 'skipped'
          );
          if (allChildrenDone) {
            updatedSteps[node.id] = {
              ...updatedSteps[node.id],
              status: 'completed',
              completedAt: Timestamp.now(),
            };
            hasChanges = true;
          }
        }
      }
    }

    // Calculate progress (exclude start, end, and sub-steps — use subprocess container for progress)
    const allStepEntries = Object.entries(updatedSteps);
    const nonStartEndSteps = allStepEntries.filter(([nodeId, step]) => {
      // Exclude flattened sub-steps from progress calculation (subprocess container counts instead)
      if (step.isSubStep) return false;
      const node = template.nodes.find(n => n.id === nodeId);
      return node && node.type !== 'start' && node.type !== 'end';
    });

    const completedSteps = nonStartEndSteps.filter(
      ([, step]) => step.status === 'completed' || step.status === 'skipped'
    );

    const progress = nonStartEndSteps.length > 0
      ? Math.round((completedSteps.length / nonStartEndSteps.length) * 100)
      : 0;

    // Calculate active node IDs
    const activeNodeIds = allStepEntries
      .filter(([, step]) => step.status === 'ready' || step.status === 'in_progress' || step.status === 'ai_review')
      .map(([nodeId]) => nodeId);

    // Compute denormalized Kanban fields
    const activeAssigneeIds = Array.from(new Set(
      allStepEntries
        .filter(([, step]) =>
          (step.status === 'ready' || step.status === 'in_progress') &&
          step.assignment?.userId
        )
        .map(([, step]) => step.assignment!.userId)
    ));

    const activeStepLabels = allStepEntries
      .filter(([, step]) => step.status === 'ready' || step.status === 'in_progress')
      .map(([nodeId]) => {
        const node = template.nodes.find(n => n.id === nodeId);
        return node?.label || nodeId;
      });

    // Check if all steps are completed
    const allStepsCompleted = allStepEntries.every(
      ([, step]) => step.status === 'completed' || step.status === 'skipped'
    );

    const status = allStepsCompleted ? 'completed' : instance.status;

    // Collect newly-ready AI task node IDs for auto-triggering (returned to caller)
    const newlyReadyAiNodeIds = allStepEntries
      .filter(([nodeId, step]) => {
        if (step.status !== 'ready') return false;
        const node = template.nodes.find(n => n.id === nodeId);
        return node?.type === 'ai_task';
      })
      .map(([nodeId]) => nodeId);

    // Update the instance if there were changes
    if (hasChanges || progress !== instance.progress || activeNodeIds.join(',') !== instance.activeNodeIds.join(',') || status !== instance.status) {
      await updateWorkflowInstance(tenantId, instanceId, {
        steps: updatedSteps,
        progress,
        activeNodeIds,
        activeAssigneeIds,
        activeStepLabels,
        status,
        ...(status === 'completed' && { completedAt: Timestamp.now() }),
      });
    }

    return newlyReadyAiNodeIds;
  } catch (error) {
    console.error('Error advancing workflow:', error);
    throw new Error(`Failed to advance workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Starts a step by assigning it to a user
 */
export async function startStep(
  tenantId: string,
  instanceId: string,
  nodeId: string,
  userId: string,
  userName: string,
  userRole: string
): Promise<void> {
  try {
    const instance = await getWorkflowInstance(tenantId, instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    const step = instance.steps[nodeId];
    if (!step) {
      throw new Error(`Step ${nodeId} not found in workflow instance`);
    }

    if (step.status !== 'ready') {
      throw new Error(`Step ${nodeId} is not ready to start. Current status: ${step.status}`);
    }

    // Update step status
    await updateStepStatus(tenantId, instanceId, nodeId, {
      status: 'in_progress',
      assignment: {
        userId,
        userName,
        userRole,
        assignedAt: Timestamp.now(),
      },
      startedAt: Timestamp.now(),
    });

    // Add audit log entry
    await addAuditLogEntry(tenantId, instanceId, {
      action: 'step_started',
      description: `"${nodeId}" adimi ${userName} tarafindan baslatildi`,
      userId,
    });

    // Advance workflow to update active nodes
    await advanceWorkflow(tenantId, instanceId);
  } catch (error) {
    console.error('Error starting step:', error);
    throw new Error(`Failed to start step: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Completes a step with optional form data, deliverables, and output data
 */
export async function completeStep(
  tenantId: string,
  instanceId: string,
  nodeId: string,
  formData?: Record<string, any>,
  deliverables?: Array<{ name: string; url: string; type: string }>,
  outputData?: Record<string, any>
): Promise<void> {
  try {
    const instance = await getWorkflowInstance(tenantId, instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    const step = instance.steps[nodeId];
    if (!step) {
      throw new Error(`Step ${nodeId} not found in workflow instance`);
    }

    if (step.status !== 'in_progress' && step.status !== 'ai_review') {
      throw new Error(`Step ${nodeId} cannot be completed. Current status: ${step.status}`);
    }

    // Update step status
    const updateData: Partial<StepInstance> = {
      status: 'completed',
      completedAt: Timestamp.now(),
    };

    if (formData) {
      updateData.formData = formData;
    }

    if (deliverables) {
      updateData.deliverables = deliverables as StepInstance['deliverables'];
    }

    if (outputData) {
      updateData.outputData = outputData;
    }

    await updateStepStatus(tenantId, instanceId, nodeId, updateData);

    // Merge output data into instance context under a namespaced key to prevent collisions
    if (outputData) {
      const ctxKey = `step_${nodeId.replace(/[.:]/g, '_')}`;
      const updatedContext = {
        ...instance.context,
        [ctxKey]: outputData,
      };

      await updateWorkflowInstance(tenantId, instanceId, {
        context: updatedContext,
      });
    }

    // Add audit log entry
    await addAuditLogEntry(tenantId, instanceId, {
      action: 'step_completed',
      description: `"${nodeId}" adimi tamamlandi`,
      userId: step.assignment?.userId || 'system',
    });

    // Advance workflow to progress
    await advanceWorkflow(tenantId, instanceId);
  } catch (error) {
    console.error('Error completing step:', error);
    throw new Error(`Failed to complete step: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Rejects a step and sends it back for revision
 */
export async function rejectStep(
  tenantId: string,
  instanceId: string,
  nodeId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  try {
    const instance = await getWorkflowInstance(tenantId, instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    const template = await getWorkflowTemplate(tenantId, instance.templateId);
    if (!template) {
      throw new Error(`Workflow template ${instance.templateId} not found`);
    }

    const step = instance.steps[nodeId];
    if (!step) {
      throw new Error(`Step ${nodeId} not found in workflow instance`);
    }

    const node = template.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in template`);
    }

    // Get the review configuration
    const reviewConfig = node.reviewConfig;
    if (!reviewConfig) {
      throw new Error(`Node ${nodeId} does not have review configuration`);
    }

    const rejectionTarget = reviewConfig.rejectionTarget;
    const maxRejections = reviewConfig.maxRejections || 3;

    if (rejectionTarget && step.currentRevision < maxRejections) {
      // Send back for revision
      const revisionEntry = {
        revisionNumber: step.currentRevision + 1,
        rejectedAt: Timestamp.now(),
        rejectedBy,
        reason,
      };

      const revisions = [...(step.revisions || []), revisionEntry];

      // Check that the target step exists
      if (!instance.steps[rejectionTarget]) {
        throw new Error(`Rejection target ${rejectionTarget} not found in workflow instance`);
      }

      // Update the target step to revision_needed
      await updateStepStatus(tenantId, instanceId, rejectionTarget, {
        status: 'revision_needed',
        currentRevision: step.currentRevision + 1,
        revisions,
      });

      // Reset the current review step to pending
      await updateStepStatus(tenantId, instanceId, nodeId, {
        status: 'pending',
      });

      // Add audit log entry
      await addAuditLogEntry(tenantId, instanceId, {
        action: 'step_rejected',
        description: `"${nodeId}" adimi reddedildi. Sebep: ${reason}. Revizyon: ${step.currentRevision + 1}`,
        userId: rejectedBy,
      });
    } else {
      // Escalate - max rejections reached or no rejection target
      await updateStepStatus(tenantId, instanceId, nodeId, {
        status: 'blocked',
      });

      // Add audit log entry
      await addAuditLogEntry(tenantId, instanceId, {
        action: 'step_escalated',
        description: `"${nodeId}" adimi eskale edildi: ${step.currentRevision >= maxRejections ? 'Maksimum red sayisina ulasildi' : 'Red hedefi yapilandirilmamis'}`,
        userId: rejectedBy,
      });
    }

    // Advance workflow to update active nodes
    await advanceWorkflow(tenantId, instanceId);
  } catch (error) {
    console.error('Error rejecting step:', error);
    throw new Error(`Failed to reject step: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Skips a step
 */
export async function skipStep(
  tenantId: string,
  instanceId: string,
  nodeId: string,
  userId: string
): Promise<void> {
  try {
    const instance = await getWorkflowInstance(tenantId, instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    const step = instance.steps[nodeId];
    if (!step) {
      throw new Error(`Step ${nodeId} not found in workflow instance`);
    }

    // Update step status
    await updateStepStatus(tenantId, instanceId, nodeId, {
      status: 'skipped',
    });

    // Add audit log entry
    await addAuditLogEntry(tenantId, instanceId, {
      action: 'step_skipped',
      description: `"${nodeId}" adimi atlandi`,
      userId,
    });

    // Advance workflow
    await advanceWorkflow(tenantId, instanceId);
  } catch (error) {
    console.error('Error skipping step:', error);
    throw new Error(`Failed to skip step: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Evaluates a condition node's configuration against the workflow context
 */
export function evaluateCondition(
  conditionConfig: Record<string, any>,
  context: Record<string, any>
): boolean {
  try {
    const { field, operator, value } = conditionConfig;

    if (!field || !operator) {
      throw new Error('Condition configuration must include field and operator');
    }

    const contextValue = context[field];

    switch (operator) {
      case 'equals':
        return contextValue === value;

      case 'not_equals':
        return contextValue !== value;

      case 'greater_than':
        return Number(contextValue) > Number(value);

      case 'less_than':
        return Number(contextValue) < Number(value);

      case 'greater_than_or_equal':
        return Number(contextValue) >= Number(value);

      case 'less_than_or_equal':
        return Number(contextValue) <= Number(value);

      case 'contains':
        if (Array.isArray(contextValue)) {
          return contextValue.includes(value);
        }
        if (typeof contextValue === 'string') {
          return contextValue.includes(String(value));
        }
        return false;

      case 'not_contains':
        if (Array.isArray(contextValue)) {
          return !contextValue.includes(value);
        }
        if (typeof contextValue === 'string') {
          return !contextValue.includes(String(value));
        }
        return true;

      case 'exists':
        return contextValue !== undefined && contextValue !== null;

      case 'not_exists':
        return contextValue === undefined || contextValue === null;

      case 'in':
        if (!Array.isArray(value)) {
          throw new Error('Value must be an array for "in" operator');
        }
        return value.includes(contextValue);

      case 'not_in':
        if (!Array.isArray(value)) {
          throw new Error('Value must be an array for "not_in" operator');
        }
        return !value.includes(contextValue);

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  } catch (error) {
    console.error('Error evaluating condition:', error);
    throw new Error(`Failed to evaluate condition: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
