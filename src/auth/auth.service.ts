import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/RegisterDto.js';
import { LoginDto } from './dto/LoginDto.js';
import { UpdateProfileDto } from '../user/dto/update-profile.dto.js';
import * as bcrypt from "bcrypt"
import { createHash, randomUUID } from 'node:crypto';

export interface JwtPayload {
    name: string;
    userId: string;
    role: string;
}

interface RefreshPayload {
    userId: string;
}

const REFRESH_EXPIRES_IN = '7d';

// SHA-256, not bcrypt: bcrypt only looks at the first 72 bytes, and two JWTs for the
// same user share their first 72 bytes, so bcrypt would treat different tokens as equal.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UserService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) { }

    /** Sign a new access + refresh token pair and remember the refresh token's hash on the user. */
    private async issueTokens(payload: JwtPayload) {
        const accessToken = await this.jwtService.signAsync(payload);
        const refreshToken = await this.jwtService.signAsync(
            { userId: payload.userId } satisfies RefreshPayload,
            {
                secret: this.config.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: REFRESH_EXPIRES_IN,
                jwtid: randomUUID(),           // makes every refresh token unique, even within the same second
            },
        );

        await this.usersService.setRefreshTokenHash(payload.userId, hashToken(refreshToken));
        return { accessToken, refreshToken };
    }

    async register(dto: RegisterDto) {
        // create() throws 409 if the email exists, and never returns the password hash
        const user = await this.usersService.create(dto);
        return { id: user._id, name: user.name, email: user.email, role: user.role };
    }

    async login(dto: LoginDto) {
        const user = await this.usersService.findByEmailWithPassword(dto.email);

        // Generic message — never reveal WHICH field was wrong
        if (!user || !(await bcrypt.compare(dto.password, user.password))) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload: JwtPayload = { userId: user._id.toString(), role: user.role, name: user.name };  // minimal — no secrets
        const { accessToken, refreshToken } = await this.issueTokens(payload);
        return { token: accessToken, refreshToken, userData: payload };
    }

    /**
     * Swap a valid refresh token for a new token pair (rotation).
     * The old refresh token stops working. If someone presents an old one, assume it was
     * stolen and log the user out everywhere.
     */
    async refresh(refreshToken: string) {
        let decoded: RefreshPayload;
        try {
            decoded = await this.jwtService.verifyAsync<RefreshPayload>(refreshToken, {
                secret: this.config.get<string>('JWT_REFRESH_SECRET'),
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const user = await this.usersService.findByIdWithRefreshToken(decoded.userId);
        if (!user || !user.refreshTokenHash) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        if (user.refreshTokenHash !== hashToken(refreshToken)) {
            // A correctly signed but already-used token was replayed: revoke the session.
            await this.usersService.setRefreshTokenHash(user._id, null);
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        // Re-read role/name from the DB so role changes take effect on the next refresh
        const payload: JwtPayload = { userId: user._id.toString(), role: user.role, name: user.name };
        const { accessToken, refreshToken: newRefreshToken } = await this.issueTokens(payload);
        return { token: accessToken, refreshToken: newRefreshToken, userData: payload };
    }

    async logout(userId: string) {
        await this.usersService.setRefreshTokenHash(userId, null);
        return { loggedOut: true };
    }

    getProfile(userId: string) {
        return this.usersService.findOne(userId);
    }

    updateProfile(userId: string, dto: UpdateProfileDto) {
        return this.usersService.update(userId, dto);
    }
}
