import { User } from '@prisma/client';
import { CreateUserData, UpdateUserData } from '../types/user.types';
export declare class UserService {
    static createUser(data: CreateUserData): Promise<User>;
    static upsertUser(data: CreateUserData): Promise<User>;
    static getUserByTelegramId(telegramId: bigint): Promise<User | null>;
    static getUserById(id: number): Promise<User | null>;
    static updateUser(id: number, data: UpdateUserData): Promise<User>;
    static setAdminStatus(telegramId: bigint, isAdmin: boolean): Promise<User>;
    static isAdmin(telegramId: bigint): Promise<boolean>;
    static setActiveStatus(telegramId: bigint, isActive: boolean): Promise<User>;
    static getAdmins(): Promise<User[]>;
    static getActiveUsersInGroup(groupId: number): Promise<User[]>;
    static getUsersByGroupId(groupId: number): Promise<User[]>;
    static getUserStats(): Promise<{
        total: number;
        active: number;
        admins: number;
    }>;
    createOrUpdate(data: CreateUserData): Promise<User>;
    getByTelegramId(telegramId: bigint): Promise<User | null>;
    isAdmin(telegramId: bigint): Promise<boolean>;
    static updatePaymentInfo(userId: number, data: {
        paymentCard?: string;
        paymentPhone?: string;
        paymentDetails?: string;
    }): Promise<User>;
    static getPaymentInfo(userId: number): Promise<{
        paymentCard?: string | null;
        paymentPhone?: string | null;
        paymentDetails?: string | null;
    } | null>;
    static getMaskedPaymentInfo(userId: number): Promise<{
        paymentCard?: string | null;
        paymentPhone?: string | null;
        paymentDetails?: string | null;
    } | null>;
}
//# sourceMappingURL=user.service.d.ts.map