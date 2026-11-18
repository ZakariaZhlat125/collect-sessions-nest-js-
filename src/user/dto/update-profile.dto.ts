import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

// What a logged-in user may change on their OWN account: name and password only.
// No `role` (a user must not make themselves admin) and no `email`.
export class UpdateProfileDto extends PartialType(PickType(CreateUserDto, ['name', 'password'] as const)) { }
