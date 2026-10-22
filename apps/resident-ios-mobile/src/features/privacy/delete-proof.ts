import type { SetupStatus } from '../../auth/setup-status';

export type ProofMethods = {
  /** The password is checked when the account has one or its history is unknown (never when it is known to have none). */
  password: boolean;
  google: boolean;
  /** An Apple-linked account must confirm with Apple: the deletion has to disconnect that sign-in. */
  apple: boolean;
};

/** Which ways the resident can prove it is them for deletion, from the server's account status. */
export function proofMethods(status: SetupStatus): ProofMethods {
  return { password: status.passwordSet !== false && !status.hasAppleIdentity, google: status.hasGoogleIdentity && !status.hasAppleIdentity, apple: status.hasAppleIdentity };
}

export function hasAnyProof(methods: ProofMethods): boolean {
  return methods.password || methods.google || methods.apple;
}
