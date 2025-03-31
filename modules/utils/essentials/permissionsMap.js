// 📁 utils/essentials/permissionsMap.js
const { PermissionsBitField } = require('discord.js');

const permissionsMap = {
  // 🌐 General Visibility Sets
  publicReadOnly: (guild, role = null) => {
    const perms = [
      {
        id: guild.roles.everyone.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory
        ],
        deny: [PermissionsBitField.Flags.SendMessages]
      }
    ];
    if (role?.id) {
      perms.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.SendMessages]
      });
    }
    return perms;
  },

  publicWrite: guild => [
    {
      id: guild.roles.everyone.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    }
  ],

  // 🔒 Restricted Access Sets
  staffOnly: (guild, role = null) => {
    const admin = guild.roles.cache.find(r =>
      r.permissions.has(PermissionsBitField.Flags.Administrator)
    );
    const perms = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: admin?.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }
    ];
    if (role?.id) {
      perms.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      });
    }
    return perms;
  },

  modOnly: (guild, role = null) => {
    const mod = guild.roles.cache.find(r => r.name.toLowerCase().includes('mod'));
    const perms = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: mod?.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }
    ];
    if (role?.id) {
      perms.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      });
    }
    return perms;
  },

  // 🎤 Voice Channel Access
  voiceReadNoJoin: (guild, role = null) => {
    const perms = [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.Connect]
      }
    ];
    if (role?.id) {
      perms.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.Connect]
      });
    }
    return perms;
  },

  voiceSpeakOnly: (guild, role = null) => {
    const streamer = guild.roles.cache.find(r => r.name.toLowerCase().includes('streamer'));
    const perms = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.Connect] },
      {
        id: streamer?.id,
        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
      }
    ];
    if (role?.id) {
      perms.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
      });
    }
    return perms;
  },

  // 🧪 Controlled Interaction Sets
  readAndReactOnly: (guild, role = null) => {
    const perms = [
      {
        id: guild.roles.everyone.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AddReactions
        ],
        deny: [PermissionsBitField.Flags.SendMessages]
      }
    ];
    if (role?.id) {
      perms.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.SendMessages]
      });
    }
    return perms;
  },

  feedbackWriteOnly: (guild, role = null) => {
    const perms = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      }
    ];
    if (role?.id) {
      perms.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      });
    }
    return perms;
  },

  // 🎮 Community + Esports Roles
  teamOnly: (guild, role) => [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: role?.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
    }
  ],

  donatorOnly: (guild, role) => [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: role?.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.UseApplicationCommands,
        PermissionsBitField.Flags.SendMessages
      ]
    }
  ],

  adultOnly: (guild, role = null) => {
    const r18 = guild.roles.cache.find(r => r.name.toLowerCase().includes('18+'));
    const perms = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: r18?.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }
    ];
    if (role?.id) {
      perms.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      });
    }
    return perms;
  },

  // 🎨 Project + Design Roles
  designerOnly: (guild, role) => [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: role?.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.AttachFiles
      ]
    }
  ],

  // 🛠️ Custom Role Injection
  customRoleOnly: (guild, role) => [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: role?.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    }
  ]
};

module.exports = { permissionsMap };
