/**
 * A string that looks like a path on the machine a file was made on: a Windows drive path, or a
 * macOS or Linux home directory. It gives away the user name and the folder layout.
 *
 * `/Users/` and `/home/` must not continue a word, a dot or a hyphen, so an ordinary web address
 * such as https://example.com/home/page is not mistaken for a home directory.
 */
export const PATH_LIKE = /[A-Za-z]:\\|(?<![\w.%-])\/(?:Users|home)\//;

export const PATH_LIKE_MESSAGE =
  "a path-like string (such as C:\\, /Users/ or /home/)";
