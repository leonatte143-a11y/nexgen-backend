import { DataTypes, Model } from 'sequelize';

export function defineAppSetting(sequelize) {
  class AppSetting extends Model {}
  AppSetting.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      settingKey: { type: DataTypes.STRING(64), allowNull: false },
      settingValue: { type: DataTypes.JSON, allowNull: false },
    },
    {
      sequelize,
      modelName: 'AppSetting',
      tableName: 'app_settings',
      timestamps: true,
      createdAt: false,
      indexes: [{ unique: true, fields: [{ name: 'setting_key' }], name: 'app_settings_setting_key_unique' }],
    },
  );
  return AppSetting;
}
