const Joi = require('joi');

const registerSchema = Joi.object({
  role: Joi.string().valid('patient', 'doctor').required(),
  // Patient fields
  firstName: Joi.when('role', { is: 'patient', then: Joi.string().required(), otherwise: Joi.string().optional() }),
  middleName: Joi.string().allow('').optional(),
  lastName: Joi.when('role', { is: 'patient', then: Joi.string().required(), otherwise: Joi.string().optional() }),
  // Doctor fields
  name: Joi.when('role', { is: 'doctor', then: Joi.string().required(), otherwise: Joi.string().optional() }),
  email: Joi.when('role', {
    is: 'doctor',
    then: Joi.string().email().required(),
    otherwise: Joi.string().email().allow('', null).optional(),
  }),
  phone: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  gender: Joi.string().valid('Male', 'Female', 'Other').required(),
  password: Joi.string().min(8).required(),
  branchId: Joi.number().integer().positive().required(),
});

const sendOtpSchema = Joi.object({
  role: Joi.string().valid('patient', 'doctor').required(),
  channel: Joi.string().valid('phone', 'email').required(),
  target: Joi.when('channel', {
    is: 'email',
    then: Joi.string().email().required(),
    otherwise: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  }),
});

const verifyOtpSchema = Joi.object({
  role: Joi.string().valid('patient', 'doctor').required(),
  channel: Joi.string().valid('phone', 'email').required(),
  target: Joi.when('channel', {
    is: 'email',
    then: Joi.string().email().required(),
    otherwise: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  }),
  otp: Joi.string().length(6).required(),
  patientDbId: Joi.number().integer().positive().optional(),
});

module.exports = { registerSchema, sendOtpSchema, verifyOtpSchema };
