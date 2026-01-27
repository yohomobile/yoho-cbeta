#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""提取所有经书标题并保存到txt文件"""

from pathlib import Path
import json

data_dir = Path('/home/guang/happy/yoho-cbeta/data-simplified')
output_file = Path('/home/guang/happy/yoho-cbeta/all_titles.txt')

titles = []
for json_file in data_dir.rglob('*.json'):
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            title = data.get('header', {}).get('title', '')
            if title:
                titles.append(title)
    except Exception as e:
        pass

# 按标题排序并去重
unique_titles = sorted(set(titles))

# 写入文件
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(f"经书标题列表（共 {len(unique_titles)} 部）\n")
    f.write("=" * 60 + "\n\n")
    for i, title in enumerate(unique_titles, 1):
        f.write(f"{i:4d}. {title}\n")

print(f"已保存 {len(unique_titles)} 个标题到: {output_file}")
