import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// The comment's `name` is taken from the logged-in user, not from the body.
export class AddCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Comment text is required' })
  @MaxLength(1000)
  text: string;
}
