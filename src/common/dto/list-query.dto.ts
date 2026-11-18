import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)   // cap the limit
  limit: number = 10;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsIn(['createdAt', 'title'])                   // never trust a raw sort field
  sort: string = 'createdAt';
}