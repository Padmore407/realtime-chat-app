class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { HttpError, escapeRegex };
