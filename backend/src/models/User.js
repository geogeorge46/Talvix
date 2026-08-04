import mongoose from 'mongoose';

import { USER_ROLES, USER_ROLE_VALUES } from '../constants/roles.js';
import { hashPassword } from '../utils/password.js';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    name: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      required: true,
    },
    roles: {
      type: [String],
      enum: USER_ROLE_VALUES,
      required: true,
    },
    providers: {
      type: [String],
      enum: ['LOCAL', 'GOOGLE', 'GITHUB'],
      default: ['LOCAL'],
      required: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true,
    },
    avatar: {
      type: String,
      default: null,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
    recruiterVerificationStatus: {
      type: String,
      enum: ['none', 'pending', 'verified', 'rejected'],
      default: 'none',
      required: true,
    },
    tokenVersion: {
      type: Number,
      default: 1,
      required: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_document, returnedObject) => {
        delete returnedObject.password;
        delete returnedObject.refreshTokenHash;
        delete returnedObject.isActive;
        return returnedObject;
      },
    },
  },
);

userSchema.pre('validate', function syncFields() {
  if (this.role && (!this.roles || this.roles.length === 0)) {
    this.roles = [this.role];
  } else if (this.roles && this.roles.length > 0 && !this.role) {
    this.role = this.roles[0];
  } else if (!this.role && (!this.roles || this.roles.length === 0)) {
    this.role = USER_ROLES.CANDIDATE;
    this.roles = [USER_ROLES.CANDIDATE];
  }
  
  if (this.fullName) {
    this.name = this.fullName;
  } else if (this.name) {
    this.fullName = this.name;
  }
  if (this.isVerified !== undefined) {
    this.emailVerified = this.isVerified;
  } else if (this.emailVerified !== undefined) {
    this.isVerified = this.emailVerified;
  }
  if (this.isActive !== undefined) {
    this.blocked = !this.isActive;
  } else if (this.blocked !== undefined) {
    this.isActive = !this.blocked;
  }
});

userSchema.pre('save', async function hashModifiedPassword() {
  if (this.password && this.isModified('password')) {
    this.password = await hashPassword(this.password);
  }
});

export const User = mongoose.model('User', userSchema);
