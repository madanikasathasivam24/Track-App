interface AxiosLikeError {
  response?: { status?: number; data?: { message?: string } };
}

function isAxiosLikeError(err: unknown): err is AxiosLikeError {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export function getStatus(err: unknown): number | undefined {
  return isAxiosLikeError(err) ? err.response?.status : undefined;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosLikeError(err) && err.response?.data?.message) {
    return err.response.data.message;
  }
  return fallback;
}

// Shared mapping for the common status codes most endpoints return, with
// per-call overrides for the context-specific 404/409 copy.
export function getCommonErrorMessage(err: unknown, overrides?: { notFound?: string; conflict?: string }): string {
  const status = getStatus(err);
  if (status === 403) return "You don't have permission to do this";
  if (status === 404) return overrides?.notFound ?? getApiErrorMessage(err, 'Not found');
  if (status === 409) return overrides?.conflict ?? getApiErrorMessage(err, 'Already done');
  return getApiErrorMessage(err, 'Something went wrong. Please try again.');
}
