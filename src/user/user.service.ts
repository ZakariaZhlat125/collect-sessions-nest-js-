import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema.js';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) { }

  create(createUserDto: CreateUserDto) {
    return this.userModel.create(createUserDto);
  }


  findAll() {
    return `This action returns all user`;
  }
  
  findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email }).select('+password');
  }
  findOne(id: number) {
    return this.userModel.findOne({ id });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.userModel.updateOne({ id }, updateUserDto);
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
