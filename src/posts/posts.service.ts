import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { AddCommentDto } from './dto/add-comment.dto.js';
import { ListQueryDto } from '../common/dto/list-query.dto.js';
import { Post } from './schemas/post.schema.js';
import { JwtPayload } from '../auth/auth.service.js';
import { UserRole } from '../user/dto/create-user.dto.js';

const AUTHOR_FIELDS = 'name email';   // ALWAYS limit populated fields

@Injectable()
export class PostsService {
  constructor(@InjectModel(Post.name) private readonly postModel: Model<Post>) { }

  async create(dto: CreatePostDto, user: JwtPayload) {
    const post = await this.postModel.create({ ...dto, author: new Types.ObjectId(user.userId) });
    return post.populate('author', AUTHOR_FIELDS);
  }

  async findAll({ page, limit, search, sort }: ListQueryDto) {
    // Escape regex special chars so user input can't build a slow/odd regex
    const filter = search
      ? { title: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      : {};

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('author', AUTHOR_FIELDS)
        .sort({ [sort]: sort === 'title' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.postModel.countDocuments(filter),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: Types.ObjectId) {
    const post = await this.postModel.findById(id).populate('author', AUTHOR_FIELDS);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async update(id: Types.ObjectId, dto: UpdatePostDto, user: JwtPayload) {
    const post = await this.findOwnedPost(id, user);
    Object.assign(post, dto);
    await post.save();
    return post.populate('author', AUTHOR_FIELDS);
  }

  async remove(id: Types.ObjectId, user: JwtPayload) {
    const post = await this.findOwnedPost(id, user);
    await post.deleteOne();
    return { deleted: true, id: post._id };
  }

  async addComment(id: Types.ObjectId, dto: AddCommentDto, user: JwtPayload) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');

    post.comments.push({ text: dto.text, name: user.name });
    await post.save();
    return post.populate('author', AUTHOR_FIELDS);
  }

  /** Only the post's author (or an admin) may change or delete it. */
  private async findOwnedPost(id: Types.ObjectId, user: JwtPayload) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');

    const isOwner = post.author.toString() === user.userId;
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) throw new ForbiddenException('You can only modify your own posts');

    return post;
  }
}
