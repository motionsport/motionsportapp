import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { apiError } from '../common/api-error';
import { RegisterMemberInviteDto } from './dto/register-member-invite.dto';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard, SessionUser } from './session.guard';
import { CurrentUser } from './current-user.decorator';
import { byRole } from './roles';
import { RegisterMemberDto } from './dto/register-member.dto';
import { LoginMemberDto } from './dto/login-member.dto';
import { RecoverMemberDto } from './dto/recover-member.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TeamGuard } from '../common/guards/team.guard';
import { clearSessionCookies, setSessionCookies } from './session-cookies';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('member/register')
  async registerMember(@Body() dto: RegisterMemberDto, @Res({ passthrough: true }) res: Response) {
    const { memberCode, recoveryCode, sessionToken } = await this.authService.registerMember(dto);
    setSessionCookies(res, sessionToken, 'member');
    return { memberCode, recoveryCode };
  }

  // «Запросити нового клієнта»: the client's page before the PIN
  @Get('member/invite/:token')
  async memberInvite(@Param('token') token: string) {
    const preview = await this.authService.memberInvitePreview(token.slice(0, 200));
    if (!preview) throw new NotFoundException(apiError('INVITE_INVALID'));
    return preview;
  }

  @Post('member/register-invite')
  async registerMemberInvite(@Body() dto: RegisterMemberInviteDto, @Res({ passthrough: true }) res: Response) {
    const { memberCode, recoveryCode, sessionToken } = await this.authService.registerMemberInvite(dto);
    setSessionCookies(res, sessionToken, 'member');
    return { memberCode, recoveryCode };
  }

  @Post('member/login')
  @HttpCode(HttpStatus.OK)
  async loginMember(@Body() dto: LoginMemberDto, @Res({ passthrough: true }) res: Response) {
    const { memberCode, displayName, sessionToken } = await this.authService.loginMember(dto);
    setSessionCookies(res, sessionToken, 'member');
    return { memberCode, displayName };
  }

  @Post('member/forgot')
  @HttpCode(HttpStatus.OK)
  async recoverMember(@Body() dto: RecoverMemberDto, @Res({ passthrough: true }) res: Response) {
    const { memberCode, recoveryCode, sessionToken } = await this.authService.recoverMember(dto);
    setSessionCookies(res, sessionToken, 'member');
    return { memberCode, recoveryCode };
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async loginAdmin(@Body() dto: LoginAdminDto, @Res({ passthrough: true }) res: Response) {
    const { sessionToken, ...who } = await this.authService.loginAdmin(dto);
    setSessionCookies(res, sessionToken, who.role);
    return who;
  }

  @Get('admin/invite/:token')
  checkInvite(@Param('token') token: string) {
    return this.authService.checkInvite(token);
  }

  @Post('admin/register')
  async registerAdmin(@Body() dto: RegisterAdminDto, @Res({ passthrough: true }) res: Response) {
    const { username, sessionToken } = await this.authService.registerAdmin(dto);
    setSessionCookies(res, sessionToken, 'admin');
    return { username };
  }

  // «Мій пароль»: a trainer or the owner
  @Post('admin/password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, TeamGuard)
  changePassword(@CurrentUser() user: SessionUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async logout(@CurrentUser() user: SessionUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.revokeSession(user.sessionId);
    clearSessionCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: SessionUser) {
    return byRole(user, {
      member: (u) => ({ type: u.type, id: u.id, memberCode: u.memberCode, displayName: u.displayName }),
      admin: (u) => ({ type: u.type, id: u.id, username: u.username }),
      owner: (u) => ({ type: u.type, id: u.id, email: u.email, name: u.name }),
    });
  }
}
