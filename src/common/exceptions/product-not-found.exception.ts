import { ConflictException, NotFoundException } from "@nestjs/common";


export class ProductNotfoundException extends NotFoundException {
    constructor(title: string) {
        super(`${title} this  product  not available`)
    }
}