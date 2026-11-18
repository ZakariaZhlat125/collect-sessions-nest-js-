import { PickType } from "@nestjs/mapped-types";
import { CreateUserDto } from "../../user/dto/create-user.dto.js";

// Same rules as CreateUserDto, but WITHOUT `role`:
// anyone who registers is a normal user (whitelist rejects a `role` field).
export class RegisterDto extends PickType(CreateUserDto, ['name', 'email', 'password'] as const) { }
