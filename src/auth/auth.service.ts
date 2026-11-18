import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/RegisterDto.js';
import { LoginDto } from './dto/LoginDto.js';
import { UpdateProfileDto } from '../user/dto/update-profile.dto.js';
import * as bcrypt from "bcrypt"

export interface JwtPayload {
    name: string;
    userId: string;
    role: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UserService,
        private readonly jwtService: JwtService,
    ) { }

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
        return { token: await this.jwtService.signAsync(payload), userData: payload };
    }

    getProfile(userId: string) {
        return this.usersService.findOne(userId);
    }

    updateProfile(userId: string, dto: UpdateProfileDto) {
        return this.usersService.update(userId, dto);
    }
}
