export const projectCount = (...responses) => responses.reduce(
  (total, response) => total + (parseInt(response?.headers?.num_found) || 0),
  0
)
