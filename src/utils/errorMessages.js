const NETWORK_ERROR_MESSAGE =
  "Unable to connect to TeamSync. Check your internet connection and try again.";

export function getFriendlyErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error instanceof TypeError || error?.name === "NetworkError") {
    return NETWORK_ERROR_MESSAGE;
  }

  if (error?.name === "AbortError") {
    return "The request was interrupted. Please try again.";
  }

  return error?.message || fallback;
}
