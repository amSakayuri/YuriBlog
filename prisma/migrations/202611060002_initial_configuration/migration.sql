INSERT INTO "SiteSetting" ("key","value","updatedAt") VALUES
  ('site','{"title":"Yuri Blog"}',NOW()),
  ('giscus','{"enabled":false}',NOW());
INSERT INTO "NavigationItem" ("id","title","titleEn","href","external","visible","order") VALUES
  ('nav-articles','文章','Articles','/articles',false,true,0),
  ('nav-works','作品','Works','/works',false,true,1),
  ('nav-archive','归档','Archive','/archive',false,true,2),
  ('nav-tags','标签','Tags','/tags',false,true,3),
  ('nav-projects','项目','Projects','/projects',false,true,4),
  ('nav-about','关于','About','/about',false,true,5);
