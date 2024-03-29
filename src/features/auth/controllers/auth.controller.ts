import { Body, Controller, Get, HttpCode, Ip, Post, Res, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';

import { JwtAuthGuard } from '../../../infrastructure/guards/jwt-auth.guard';
import { CookieJwtGuard } from '../../../infrastructure/guards/jwt-cookie.guard';
import { LocalAuthGuard } from '../../../infrastructure/guards/local-auth.guard';
import { SessionService } from '../../security/service/session.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserAgent } from '../decorators/user-agent-from-headers.decorator';
import { CurrentSession } from '../decorators/userId-sessionKey.decorator';
import { ChangePasswordCommand } from '../service/useCases/change-password.useCase';
import { ChangeUserConfirmationCommand } from '../service/useCases/change-User-Confirmation.useCase';
import { EmailResendingCommand } from '../service/useCases/email-resending.useCase';
import { NewPasswordRequestCommand } from '../service/useCases/new-password-request.useCase';
import { RefreshTokenCommand } from '../service/useCases/refresh-token.useCase';
import { UserGetInformationAboutMeCommand } from '../service/useCases/user-get-information-about-me.useCase';
import { UserLoginCommand } from '../service/useCases/user-login.useCase';
import { UserRegistrationCommand } from '../service/useCases/user-registration.UseCase';
import {
  EmailInBodyModel,
  EmailResendingModel,
  RecoveryCodeModel,
  UserRegistrationModel,
  ValidationCodeModel,
} from '../types/input';
import { AboutMeType } from '../types/output';

// Контроллер для аутентификации и управления пользователями
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private commandBus: CommandBus,
    private sessionService: SessionService,
  ) {}

  // Метод для аутентификации пользователя
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  async loginUser(
    @UserAgent() userAgent: string,
    @Ip() ip: string,
    @CurrentUser() userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const tokenPair = await this.commandBus.execute(new UserLoginCommand(userId, ip, userAgent));
    res.cookie('refreshToken', tokenPair.refreshToken, { httpOnly: true, secure: true });
    return { accessToken: tokenPair.token };
  }

  // Метод для регистрации нового пользователя
  @Post('registration')
  @HttpCode(204)
  async userRegistration(@Body() registrationData: UserRegistrationModel): Promise<void> {
    await this.commandBus.execute(new UserRegistrationCommand(registrationData));
  }

  // Метод для подтверждения регистрации по электронной почте
  @Post('registration-confirmation')
  @HttpCode(204)
  async userConfirmation(@Body() confirmationCode: ValidationCodeModel): Promise<void> {
    await this.commandBus.execute(new ChangeUserConfirmationCommand(confirmationCode.code, true));
  }

  // Метод для повторной отправки письма с подтверждением
  @Post('registration-email-resending')
  @HttpCode(204)
  async emailConfirmationResending(@Body() body: EmailResendingModel): Promise<void> {
    await this.commandBus.execute(new EmailResendingCommand(body.email));
  }

  // Метод для обновления токенов
  @UseGuards(CookieJwtGuard)
  @Post('refresh-token')
  @HttpCode(200)
  async createNewTokensPair(
    @CurrentSession() { userId, tokenKey }: { userId: string; tokenKey: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const tokenPair = await this.commandBus.execute(new RefreshTokenCommand(userId, tokenKey));
    res.cookie('refreshToken', tokenPair.refreshToken, { httpOnly: true, secure: true });
    return { accessToken: tokenPair.token };
  }

  // Метод для получения информации о текущем пользователе
  //TODo добавить проверку для типа AboutMeType
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getUserInformation(@CurrentUser() userId: string): Promise<AboutMeType> {
    return this.commandBus.execute(new UserGetInformationAboutMeCommand(userId));
  }

  // Метод для запроса восстановления пароля
  //никаких проверок что пользователь с таким емайлом существует, нет. Но возможность добавить есть внутри командБаса
  @Post('password-recovery')
  @HttpCode(204)
  async newPassword(@Body() { email }: EmailInBodyModel): Promise<void> {
    await this.commandBus.execute(new NewPasswordRequestCommand(email));
  }

  // Метод для установки нового пароля
  //Проверка на валидность кода происходит в декораторе
  @Post('new-password')
  @HttpCode(204)
  async newPasswordSet(@Body() { newPassword, recoveryCode }: RecoveryCodeModel): Promise<void> {
    await this.commandBus.execute(new ChangePasswordCommand(newPassword, recoveryCode));
  }

  @UseGuards(CookieJwtGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentSession() { userId, tokenKey }: { userId: string; tokenKey: string }): Promise<void> {
    await this.sessionService.terminateCurrentSession(userId, tokenKey);
  }
}
