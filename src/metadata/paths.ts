/**
 * A string that looks like a path on the machine a file was made on: a Windows drive path, or a
 * macOS or Linux home directory. It gives away the user name and the folder layout.
 */
export const PATH_LIKE = /[A-Za-z]:\\|\/Users\/|\/home\//;

export const PATH_LIKE_MESSAGE =
  "a path-like string (such as C:\\, /Users/ or /home/)";
