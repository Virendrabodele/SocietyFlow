import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, mobile, password, role } = req.body;
    const prisma = getPrismaClient();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user - default role is RESIDENT
    const user = await prisma.user.create({
      data: {
        name,
        email,
        mobile: mobile || null,
        passwordHash,
        role: role || 'RESIDENT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: 'signup_success',
      entityType: 'user',
      entityId: user.id,
      payload: { email: user.email, role: user.role },
    });

    sendSuccessResponse(res, { user, accessToken, refreshToken }, 'User registered successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const prisma = getPrismaClient();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create audit log for failed login
      await createAuditLog({
        userId: 'unknown',
        action: 'login_failure',
        entityType: 'user',
        payload: { email, reason: 'user_not_found' },
      }).catch(() => {
        // Ignore audit log errors
      });
      throw new AppError('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('User account is inactive', 403);
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // Create audit log for failed login
      await createAuditLog({
        userId: user.id,
        action: 'login_failure',
        entityType: 'user',
        entityId: user.id,
        payload: { email, reason: 'invalid_password' },
      });
      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create audit log for successful login
    await createAuditLog({
      userId: user.id,
      action: 'login_success',
      entityType: 'user',
      entityId: user.id,
      payload: { email: user.email, role: user.role },
    });

    sendSuccessResponse(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          isActive: user.isActive,
        },
        accessToken,
        refreshToken,
      },
      'Login successful'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    });

    sendSuccessResponse(res, { accessToken }, 'Token refreshed successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  // In a stateless JWT implementation, logout is handled client-side
  // The client should remove the tokens from storage
  // For more sophisticated logout (e.g., token blacklisting), implement token revocation
  sendSuccessResponse(res, {}, 'Logout successful');
};
