import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserDto, UserRole } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './schemas/user.schema.js';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly config: ConfigService,
  ) { }

  /**
   * Seed the first admin from .env (ADMIN_EMAIL / ADMIN_PASSWORD).
   * Register always creates normal users, so this is how the first admin is made.
   */
  async onModuleInit() {
    const email = this.config.get<string>('ADMIN_EMAIL')?.toLowerCase().trim();
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) return;

    const exists = await this.userModel.exists({ email });
    if (exists) return;

    await this.userModel.create({ name: 'Admin', email, password, role: UserRole.ADMIN });
    this.logger.log(`Admin user seeded: ${email}`);
  }

  async create(dto: CreateUserDto) {
    const exists = await this.userModel.exists({ email: dto.email });
    if (exists) throw new ConflictException('Email already registered');

    const user = await this.userModel.create(dto);   // password is hashed by the pre('save') hook
    return this.findOne(user._id);                     // re-read so the password is NOT returned
  }

  findAll() {
    return this.userModel.find().sort({ createdAt: -1 });
  }

  findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email }).select('+password');
  }

  async findOne(id: Types.ObjectId | string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: Types.ObjectId | string, dto: UpdateUserDto) {
    if (dto.email) {
      const taken = await this.userModel.exists({ email: dto.email, _id: { $ne: id } });
      if (taken) throw new ConflictException('Email already registered');
    }

    const user = await this.findOne(id);
    Object.assign(user, dto);
    await user.save();          // use save() (not updateOne) so the password hook runs
    return this.findOne(id);
  }

  async remove(id: Types.ObjectId | string) {
    const user = await this.userModel.findByIdAndDelete(id);
    if (!user) throw new NotFoundException('User not found');
    return { deleted: true, id: user._id };
  }
}
