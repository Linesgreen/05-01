/* eslint-disable no-underscore-dangle */
import { HttpException, Injectable } from '@nestjs/common';

import { PostgresSessionRepository } from '../repository/session.postgres.repository';

@Injectable()
export class SessionService {
  constructor(protected postgresSessionRepository: PostgresSessionRepository) {}

  async terminateCurrentSession(userId: string, tokenKey: string): Promise<void> {
    await this.postgresSessionRepository.terminateSessionByTokenKey(tokenKey);
    const chekResult = await this.postgresSessionRepository.chekSessionIsExist(Number(userId), tokenKey);
    if (chekResult) throw new HttpException('Session not terminated', 500);
  }
  async terminateAllSession(userId: string): Promise<void> {
    await this.postgresSessionRepository.terminateAllSessionByUserId(userId);
  }
}
