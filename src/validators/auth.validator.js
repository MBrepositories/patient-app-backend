const Joi = require('joi');

const loginSchema = Joi.object({
  target: Joi.string().required(),
  password: Joi.string().required(),
  channel: Joi.string().valid('mobile', 'email').required(),
});

const registerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('patient', 'doctor').required(),
});

const sendOtpSchema = Joi.object({
  channel: Joi.string().valid('phone', 'email').required(),
  target: Joi.when('channel', {
    is: 'email',
    then: Joi.string().email().required(),
    otherwise: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  }),
});

const verifyOtpSchema = Joi.object({
  channel: Joi.string().valid('phone', 'email').required(),
  target: Joi.when('channel', {
    is: 'email',
    then: Joi.string().email().required(),
    otherwise: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  }),
  otp: Joi.string().length(6).required(),
});

module.exports = { loginSchema, registerSchema, sendOtpSchema, verifyOtpSchema };
