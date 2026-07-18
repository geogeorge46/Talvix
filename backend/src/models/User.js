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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: USER_ROLES.CANDIDATE,
      required: true,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: null,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
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

userSchema.pre('save', async function hashModifiedPassword() {
  if (this.isModified('password')) {
    this.password = await hashPassword(this.password);
  }
});

export const User = mongoose.model('User', userSchema);
