import type { OperationStatus, OperationType, RegistryId } from "./CatalogTypes";

export interface OperationLogEntry {
  operationId: string;
  operationType: OperationType;
  registryId?: RegistryId;
  catalogKey?: string;
  status: OperationStatus;
  message: string;
  occurredAt: string;
}

export function createOperationLogEntry(input: OperationLogEntry): OperationLogEntry {
  return input;
}
