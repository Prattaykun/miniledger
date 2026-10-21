import { Router } from 'express';
import { requestOtp, signToken, verifyOtp } from '../auth';
import { config } from '../config';
import { asyncHandler } from '../http';
import { requestOtpSchema, verifyOtpSchema } from '../validation';

export const authRouter = Router();

authRouter.post(
  '/otp',
  asyncHandler(async (req, res) => {
    const { phone } = requestOtpSchema.parse(req.body ?? {});
    const code = await requestOtp(phone);
    // This is the mock SMS. The code is not included in the HTTP response.
    console.log(
      `[miniledger] OTP for ${phone} is ${code} (expires in ${config.otpTtlSeconds} seconds)`,
    );
    res.json({ ok: true, expiresInSeconds: config.otpTtlSeconds });
  }),
);

authRouter.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { phone, code } = verifyOtpSchema.parse(req.body ?? {});
    const user = await verifyOtp(phone, code);
    res.json({
      token: signToken(user),
      user: { id: user.id, phone: user.phone },
    });
  }),
);
