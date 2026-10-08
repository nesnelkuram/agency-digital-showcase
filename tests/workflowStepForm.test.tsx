import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const complete = vi.hoisted(() => vi.fn());
vi.mock('@/shared/services/workflowApi', () => ({ completeWorkflowStep: complete }));
vi.mock('@/shared/hooks/useTenant', () => ({ useTenantId: () => 'tenant' }));
import DynamicStepForm from '@/admin/workflows/components/instance/DynamicStepForm';

describe('workflow step form server integration', () => {
  beforeEach(() => { cleanup(); complete.mockReset(); });
  it('supports a no-form human step and waits for server completion', async () => {
    let resolve!: () => void;
    complete.mockReturnValue(new Promise<void>(r => { resolve = r; }));
    const onCompleted = vi.fn();
    render(<DynamicStepForm instanceId="run" nodeId="review" node={{} as any} onCompleted={onCompleted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adımı Tamamla' }));
    expect(complete).toHaveBeenCalledWith('run', 'review', {});
    expect(onCompleted).not.toHaveBeenCalled();
    resolve();
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
  });
  it('keeps the form open and displays server-side errors', async () => {
    complete.mockRejectedValue(new Error('Gerekli brief girdisi eksik'));
    const onCompleted = vi.fn();
    render(<DynamicStepForm instanceId="run" nodeId="review" node={{} as any} onCompleted={onCompleted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adımı Tamamla' }));
    await screen.findByText('Gerekli brief girdisi eksik');
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
