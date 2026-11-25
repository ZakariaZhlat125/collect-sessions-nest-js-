import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import * as bcrypt from "bcrypt"

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, trim: true, minlength: 2 })
    name: string;

    @Prop({ required: true, unique: true, lowercase: true })
    email: string;

    @Prop({ required: true, select: false })        // never returned unless you ask with '+password'
    password: string;

    @Prop({ enum: ['user', 'admin'], default: 'user' })
    role: string;

    // SHA-256 of the user's current refresh token (null = logged out). Never returned by default.
    @Prop({ type: String, select: false, default: null })
    refreshTokenHash: string | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

