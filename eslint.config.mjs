// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Tắt lint cho các thư mục không cần thiết
  {
    ignores: ['dist/**', 'node_modules/**', '.eslintrc.js', 'eslint.config.mjs'],
  },
  
  // Cấu hình cơ bản từ ESLint và TypeScript-ESLint
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        project: ['./tsconfig.json', './packages/*/tsconfig.json', './demo-app/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /* Rule yêu cầu: Lint các biến chưa được sử dụng */
      '@typescript-eslint/no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_'
      }],
      
      /* Giữ lại các rules cũ từ .eslintrc.js */
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      
      /* Chặn kiểu 'any' */
      '@typescript-eslint/no-explicit-any': 'error',
      
      /* Ép buộc xử lý null/undefined */
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },

  // Ghi đè quy tắc cho các file test (được phép dùng any để mock)
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'src/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Thường test hay khai báo biến mẫu
    },
  },
  
  // Áp dụng Prettier config cuối cùng để ghi đè các rule format
  prettierConfig,
);
