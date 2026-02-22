import { Request, Response } from 'express';
import { uploadProfileImageToR2 } from '../lib/r2';

export const uploadImage = async (req: Request, res: Response): Promise<Response | void> => {
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const url = await uploadProfileImageToR2(file);
        return res.json({ url });
    } catch (error) {
        console.error('Upload error', error);
        return res.status(500).json({ message: 'Failed to upload image' });
    }
};
