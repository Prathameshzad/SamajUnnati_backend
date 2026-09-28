import { Request, Response } from 'express';
import { uploadMedia } from '../lib/mediaUpload';

export const uploadImage = async (req: Request, res: Response): Promise<Response | void> => {
    let file = (req as any).file as Express.Multer.File | undefined;
    if (!file && (req as any).files) {
        const files = (req as any).files;
        if (Array.isArray(files) && files.length > 0) {
            file = files[0];
        } else if (typeof files === 'object') {
            file = files.photo?.[0] || files.image?.[0] || files.avatar?.[0] || files.media?.[0] || files.file?.[0];
        }
    }

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const url = await uploadMedia(file, { folder: 'profile', allowedKinds: ['image'] });
        return res.json({ url });
    } catch (error: any) {
        console.error('Upload error', error);
        return res.status(error?.status || 500).json({ 
            message: error?.message || 'Failed to upload image' 
        });
    }
};
