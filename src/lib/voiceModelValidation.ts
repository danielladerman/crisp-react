export function validateVoiceModel(model) {
  const errors = []

  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return { valid: false, errors: ['Model must be a non-null object'] }
  }

  if (Object.keys(model).length === 0) {
    return { valid: false, errors: ['Model is empty'] }
  }

  if (model.pendingProbes && typeof model.pendingProbes !== 'object') {
    errors.push('pendingProbes must be an object')
  }

  if (model.crossSessionPatterns && typeof model.crossSessionPatterns !== 'object') {
    errors.push('crossSessionPatterns must be an object')
  }

  if (model.sessionSignals && !Array.isArray(model.sessionSignals)) {
    errors.push('sessionSignals must be an array')
  }

  return errors.length ? { valid: false, errors } : { valid: true }
}
