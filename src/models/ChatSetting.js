import { DataTypes, Model } from 'sequelize';

export function defineChatSetting(sequelize) {
  class ChatSetting extends Model {}
  ChatSetting.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      chatEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      imageSharingEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      autoTranslationEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
      forbiddenWords: { type: DataTypes.JSON, defaultValue: ['pay me cash', 'offline', 'mobile number', 'direct payment'] },
    },
    { sequelize, modelName: 'ChatSetting', tableName: 'chat_settings', timestamps: true },
  );
  return ChatSetting;
}
