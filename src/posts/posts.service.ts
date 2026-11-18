import { Injectable } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { ListQueryDto } from '../common/dto/list-query.dto.js';
import { InjectModel } from '@nestjs/mongoose';
import { Post } from './schemas/post.schema.js';
import { Model } from 'mongoose';

@Injectable()
export class PostsService {
    constructor(@InjectModel(Post.name) private readonly postModel: Model<Post>) { }
  
  create(createPostDto: CreatePostDto) {
    return 'This action adds a new post';
  }

  // posts.service.ts
  async findAll({ page, limit, search, sort }: ListQueryDto) {
    const filter = search ? { title: { $regex: search, $options: 'i' } } : {};

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('author', 'name email')
        .sort({ [sort]: sort === 'title' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.postModel.countDocuments(filter),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }


  findOne(id: number) {
    return `This action returns a #${id} post`;
  }

  update(id: number, updatePostDto: UpdatePostDto) {
    return `This action updates a #${id} post`;
  }

  remove(id: number) {
    return `This action removes a #${id} post`;
  }

  //   findPublished() {
  //   return this.postModel
  //     .find({ published: true })
  //     .populate('author', 'name email')      // ALWAYS limit fields
  //     .sort({ createdAt: -1 });
  // }


}
