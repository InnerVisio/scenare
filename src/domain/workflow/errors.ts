/** Thrown when a workflow state machine is asked for a transition that is not allowed. */
export class WorkflowTransitionError extends Error {
  constructor(message = 'Tento přechod stavu není povolen.') {
    super(message);
    this.name = 'WorkflowTransitionError';
  }
}
