
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../user/schemas/user.schema.js';

@Schema({ _id: false })                      // a subdocument: no own _id needed
export class Comment {
  @Prop({ required: true }) text: string;
  @Prop() name: string;
}
export const CommentSchema = SchemaFactory.createForClass(Comment);

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true })
  title: string;

  // Referencing: store the author's id
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  author: Types.ObjectId;

  // Embedding: store the comments inside the post
  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];

  @Prop([String])
  tags: string[];
}

export type PostDocument = HydratedDocument<Post>;
export const PostSchema = SchemaFactory.createForClass(Post);
