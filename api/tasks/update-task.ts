import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId } = req.query;
    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'Missing taskId' });
    }

    const db = getAdminDb();
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (taskDoc.data()?.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allowedFields = [
      'status',
      'priority',
      'assigneeId',
      'assigneeName',
      'assigneeRole',
      'delegationApproved',
      'delegationApprovedBy',
      'dueDate',
      'description',
      'tags',
    ];

    const updates: Record<string, any> = {};
    const body = req.body || {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    // Handle delegation approval specially
    if (body.approveDelegation === true) {
      const taskData = taskDoc.data()!;
      if (!taskData.suggestedAssigneeId) {
        return res.status(400).json({ error: 'No suggested assignee to approve' });
      }
      updates.assigneeId = taskData.suggestedAssigneeId;
      updates.assigneeName = taskData.suggestedAssigneeName;
      updates.delegationApproved = true;
      updates.delegationApprovedBy = req.userId;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Admin SDK accepts Date objects directly; no firebase-admin import needed
    updates.updatedAt = new Date();

    await taskRef.update(updates);

    return res.status(200).json({ success: true, taskId });
  } catch (error: any) {
    console.error('tasks/update-task error:', error);
    return res.status(500).json({ error: String(error?.message || 'Update failed') });
  }
});
