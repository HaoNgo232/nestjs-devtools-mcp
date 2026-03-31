import { Controller, Get, Post, Body, Param } from '@nestjs/common'

@Controller('users')
export class UserController {
  @Get()
  findAll() {
    return []
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id }
  }

  @Post()
  create(@Body() body: unknown) {
    return body
  }
}
