/// 双人小屋：建表、权限和两个账号。PocketBase 启动时会自动执行一次。
migrate((app) => {
  const signedIn = "@request.auth.id != ''";

  // 账号：关掉自助注册，两个人互相能看到对方，自己能改自己的密码
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new NumberField({ name: "who", min: 0, max: 1, onlyInt: true }));
  users.fields.getByName("password").min = 6;
  users.listRule = signedIn;
  users.viewRule = signedIn;
  users.createRule = null;
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = null;
  app.save(users);

  // 房间里的每样东西一行：kind + ref 唯一
  const items = new Collection({
    type: "base",
    name: "items",
    listRule: signedIn, viewRule: signedIn, createRule: signedIn, updateRule: signedIn, deleteRule: signedIn,
    fields: [
      { type: "text", name: "kind", required: true, max: 40 },
      { type: "text", name: "ref", required: true, max: 120 },
      { type: "json", name: "data", maxSize: 2000000 },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_items_kind_ref ON items (kind, ref)"],
  });
  app.save(items);

  // 照片文件：需要登录后拿到的临时口令才能打开
  const photos = new Collection({
    type: "base",
    name: "photos",
    listRule: signedIn, viewRule: signedIn, createRule: signedIn, updateRule: null, deleteRule: signedIn,
    fields: [
      { type: "file", name: "file", required: true, maxSelect: 1, maxSize: 15 * 1024 * 1024,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"], protected: true },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  });
  app.save(photos);

  // 两个账号（初始密码 123456，登录后可以在"设置"里改）
  const people = [
    ["xiaoxuan@example.com", "唐小轩", 0],
    ["wanru@example.com", "宛如", 1],
  ];
  for (const [email, name, who] of people) {
    const r = new Record(users);
    r.setEmail(email);
    r.setPassword("123456");
    r.setVerified(true);
    r.set("name", name);
    r.set("who", who);
    app.save(r);
  }
}, (app) => {
  for (const n of ["items", "photos"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (e) {}
  }
});
