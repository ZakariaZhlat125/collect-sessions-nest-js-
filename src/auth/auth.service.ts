import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/RegisterDto.js';
import { LoginDto } from './dto/LoginDto.js';
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
        const existing = await this.usersService.findByEmailWithPassword(dto.email);
        if (existing) throw new ConflictException('Email already registered');

        const user = await this.usersService.create(dto);
        return { id: user._id, name: user.name, email: user.email, role: user.role };  // never the hash
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
}


