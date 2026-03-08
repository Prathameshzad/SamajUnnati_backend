// src/services/otpService.ts

export class OtpService {
    /**
     * Mock sending OTP. Currently returns "1111" by default.
     */
    static async sendOtp(phone: string): Promise<boolean> {
        console.log(`[OTP SERVICE] Mock sending OTP 1111 to ${phone}`);
        // In a real implementation, this would call an SMS gateway (Twilio, Gupshup, etc.)
        return true;
    }

    /**
     * Verify the OTP code.
     */
    static async verifyOtp(phone: string, code: string): Promise<boolean> {
        // Current requirement: default OTP is "1111"
        const isValid = code === "1111";
        console.log(`[OTP SERVICE] Verifying ${code} for ${phone}: ${isValid}`);
        return isValid;
    }
}
