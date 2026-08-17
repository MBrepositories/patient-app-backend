const Joi = require('joi');

const updateProfileSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().length(10).pattern(/^[0-9]+$/).optional(),
  dateOfBirth: Joi.string().isoDate().optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  healthGoal: Joi.string().optional(),
});

module.exports = { updateProfileSchema };
