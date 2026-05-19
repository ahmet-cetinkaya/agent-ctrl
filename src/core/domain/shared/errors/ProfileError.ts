import { UserError } from "./UserError";
import type { ErrorId } from "../constants/errorIds";

export class ProfileError extends UserError {
  readonly profileName: string;

  constructor(message: string, profileName: string, errorId?: ErrorId) {
    super(message, errorId);
    this.profileName = profileName;
  }
}
