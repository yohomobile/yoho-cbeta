#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提取所有经书标题并分析关联关系，区分经/论/疏等不同类型
"""

import json
import re
from collections import defaultdict
from pathlib import Path


def extract_title_info(json_path):
    """从JSON文件中提取标题信息"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            title = data.get('header', {}).get('title', '')
            author = data.get('header', {}).get('author', '')
            source = data.get('header', {}).get('source', '')
            return {
                'id': data.get('id', ''),
                'title': title,
                'author': author,
                'source': source
            }
    except Exception as e:
        print(f"Error reading {json_path}: {e}")
        return None


def get_text_type(title):
    """判断文本类型：经/论/疏/传等"""
    # 注疏类后缀
    zhushu_suffixes = ['疏', '释', '记', '钞', '述记', '演秘', '注', '注疏', '注解', '释论', '义疏',
                     '科文', '科注', '科疏', '大意', '释论', '论疏', '述', '序', '后记',
                     '玄义', '义记', '义疏', '解义', '解', '解疏', '会疏', '义', '略',
                     '传', '撰', '集', '述', '要钞', '要解', '要义', '手诀', '抉择',
                     '抉择', '分章', '科判', '科文', '记', '钞', '别传', '本传', '内传',
                     '旁通', '问难', '问答', '辨', '辨惑', '析疑', '发微', '探微', '微旨',
                     '指归', '指要', '指掌', '指归', '指要', '指归', '指要', '指归',
                     '决疑', '决择', '决科', '钞义', '疏记', '疏钞', '疏略', '疏科',
                     '注说', '注记', '注略', '别注', '重注', '新注', '详注', '集注',
                     '合注', '音义', '音注', '音释', '略释', '略解', '略注', '略钞']

    # 论类后缀（独立的论著）
    lun_suffixes = ['论$', '颂$', '偈颂$']

    # 经典类（主要是佛经原文的翻译）
    jing_suffixes = ['经$', '咒$', '陀罗尼$']

    # 其他类型
    other_types = ['传$', '录$', '史$', '谱$', '志$', '表$', '目$', '要$', '法$', '规$', '仪$', '轨$']

    for suffix in zhushu_suffixes:
        if title.endswith(suffix) and not title.endswith('经论'):
            return 'zhushu', suffix

    # 检查是否是经论（既是经也是论，如金刚般若波罗蜜经论）
    if '论释' in title or '论疏' in title:
        return 'zhushu', '论释'

    # 检查论类
    for suffix in lun_suffixes:
        if re.search(suffix, title):
            return 'lun', suffix

    # 检查经典类
    for suffix in jing_suffixes:
        if re.search(suffix, title):
            return 'jing', suffix

    # 检查其他类型
    for suffix in other_types:
        if re.search(suffix, title):
            return 'other', suffix

    return 'unknown', ''


def normalize_title_for_grouping(title, text_type):
    """标准化标题，用于关联分析"""
    normalized = title

    if text_type == 'jing':
        # 经典类：去除卷号等标识
        normalized = re.sub(r'\(第?\d*[-至]\d*卷\)', '', normalized)
        normalized = re.sub(r'\([^)]*\)', '', normalized)
        normalized = normalized.strip()
    elif text_type == 'lun':
        # 论类：保持论字，因为这是论著的本质特征
        # 只去除"释"等注疏后缀（如果有的话）
        pass
    elif text_type == 'zhushu':
        # 注疏类：保持疏/释/记等后缀
        # 去除"论"前面的"释"字，避免混淆
        if normalized.endswith('论释'):
            normalized = normalized[:-2]  # 去掉"释"
        elif normalized.endswith('论疏'):
            normalized = normalized[:-2]  # 去掉"疏"
    elif text_type == 'other':
        # 其他类型：保持原样
        pass

    return normalized.strip()


def extract_source_text(title, text_type):
    """
    从注疏标题中提取被注疏的经典名称
    例如: "金刚经疏" -> "金刚经"
          "成唯识论演秘" -> "成唯识论"
          "金光明经玄义拾遗记" -> "金光明经"
          "金刚般若义记" -> "金刚般若波罗蜜经"
    """
    if text_type != 'zhushu':
        return None

    # 注疏后缀列表（按长度降序排列，优先匹配长后缀）
    zhushu_suffixes = sorted([
        '述记', '演秘', '注疏', '科文', '科注', '科疏', '义疏', '论疏', '论释',
        '玄义', '义记', '解义', '解疏', '会疏', '要钞', '要解', '要义', '手诀', '抉择',
        '分章', '科判', '疏记', '疏钞', '疏略', '疏科', '钞义',
        '注说', '注记', '注略', '别注', '重注', '新注', '详注', '集注', '合注',
        '音义', '音注', '音释', '略释', '略解', '略注', '略钞',
        '疏', '释', '记', '钞', '注', '解', '述', '序', '后记', '义', '略', '撰', '集'
    ], key=len, reverse=True)

    # 优先处理长后缀
    for suffix in zhushu_suffixes:
        if title.endswith(suffix):
            # 去掉后缀
            source = title[:-len(suffix)]
            # 进一步清理
            source = re.sub(r'^(新编|重刊|校正|大明|大宋|唐|宋|元|明|清)', '', source)
            source = source.strip()
            return source if source else None

    return None


def normalize_sutra_title(title):
    """
    标准化经书标题，用于识别同一部经的不同翻译
    例如:
    - "金刚般若波罗蜜经" -> "金刚般若波罗蜜经"
    - "金刚般若波罗蜜经(第一卷)" -> "金刚般若波罗蜜经"
    - "金刚般若" -> "金刚般若波罗蜜经" (推断)
    """
    # 去掉卷号标注
    normalized = re.sub(r'\(第?\d*[-至]\d*卷\)', '', title)
    normalized = re.sub(r'\([^)]*卷\)', '', normalized)
    normalized = re.sub(r'卷\d+', '', normalized)
    normalized = re.sub(r'第[一二三四五六七八九十]+卷', '', normalized)

    # 去掉常见的朝代/译者前缀（这些在author字段里）
    prefixes_to_remove = [
        '佛说', '大方广', '大乘', '新编', '重刊', '校正',
        '大明', '大宋', '唐', '宋', '元', '明', '清'
    ]
    for prefix in prefixes_to_remove:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]

    # 去掉末尾的"经"以外的常见后缀（但保留"经"）
    # 如果以"经"结尾，可能是完整的经名
    normalized = normalized.strip()

    # 如果太短（小于3个字），可能是不完整的
    if len(normalized) < 3:
        return title.strip()

    return normalized


def extract_translator_info(author):
    """
    从author字段提取译者信息
    返回: {'朝代': '唐', '译者': '玄奘', '职务': '法师'}
    """
    result = {}
    # 常见朝代
    dynasties = ['唐', '宋', '元', '明', '清', '隋', '晋', '南北朝', '印度', '西藏', '日本', '高丽', '新罗']
    for dy in dynasties:
        if dy in author:
            result['朝代'] = dy
            break

    # 常见译者关键词
    translator_keywords = ['译', '撰', '述', '集', '造']
    for kw in translator_keywords:
        if kw in author:
            parts = author.split(kw)
            if len(parts) >= 1:
                # 取朝代后面的部分作为译者名
                name_part = parts[0]
                for dy in dynasties:
                    if dy in name_part:
                        name_part = name_part.split(dy)[-1]
                result['译者'] = name_part.strip()
            break

    return result


def build_translation_groups(all_books):
    """
    构建同一部经的不同翻译版本关联
    返回: {
        'group_key': {
            'base_title': '金刚经',  # 标准化后的经名
            'translations': [
                {'id': 'T08n0235', 'title': '金刚般若波罗蜜经', 'author': '唐 玄奘译'},
                {'id': 'T08n0236', 'title': '金刚般若波罗蜜经', 'author': '宋 施护译'},
                ...
            ],
            'total_versions': 3
        }
    }
    """
    # 只处理经典(jing)类
    jing_books = [b for b in all_books if b['text_type'] == 'jing']

    # 按标准化标题分组
    groups = defaultdict(list)
    for book in jing_books:
        norm_title = normalize_sutra_title(book['title'])
        groups[norm_title].append(book)

    # 只保留有多版本的组
    translation_groups = {}
    for norm_title, books in groups.items():
        if len(books) >= 2:
            translation_groups[norm_title] = {
                'base_title': norm_title,
                'translations': sorted([
                    {
                        'id': b['id'],
                        'title': b['title'],
                        'author': b['author'],
                        'source': b.get('source', '')
                    } for b in books
                ], key=lambda x: x['id']),
                'total_versions': len(books)
            }

    return translation_groups


def find_best_match(source, source_texts):
    """
    改进的模糊匹配：支持多种匹配模式
    1. 精确匹配
    2. 前缀匹配："金刚般若" -> "金刚般若波罗蜜经"
    3. 后缀匹配："经疏" -> "经"
    4. 子串匹配：包含关系
    """
    # 1. 精确匹配
    if source in source_texts:
        return source_texts[source]

    # 2. 尝试添加常见后缀进行匹配
    common_suffixes = ['经', '论']
    for suffix in common_suffixes:
        if not source.endswith(suffix):
            candidates = [source + suffix]
            # 也尝试"波罗蜜经"类
            if suffix == '经' and not source.endswith('波罗蜜'):
                candidates.append(source + '波罗蜜经')
            for cand in candidates:
                if cand in source_texts:
                    return source_texts[cand]

    # 3. 前缀匹配：source 是经书名的前缀
    for source_title, source_book in source_texts.items():
        if source_title.startswith(source) and len(source_title) - len(source) <= 6:
            # 经书名比source长不超过6个字符（通常是"波罗蜜"之类）
            return source_book

    # 4. 子串匹配：source 包含在经书名中，或经书名包含source
    best_match = None
    best_score = 0
    for source_title, source_book in source_texts.items():
        # 计算相似度分数
        if source in source_title:
            score = len(source) / len(source_title)  # 子串得分
        elif source_title in source:
            score = len(source_title) / len(source)  # 超串得分
        else:
            # 包含共同字符
            common = len(set(source) & set(source_title))
            if common >= 3:
                score = common / max(len(source), len(source_title))
            else:
                score = 0

        if score > best_score and score >= 0.5:  # 至少50%相似
            best_score = score
            best_match = source_book

    return best_match


def build_sutra_zhushu_mapping(all_books):
    """
    改进的模糊匹配：支持多种匹配模式
    1. 精确匹配
    2. 前缀匹配："金刚般若" -> "金刚般若波罗蜜经"
    3. 后缀匹配："经疏" -> "经"
    4. 子串匹配：包含关系
    """
    # 1. 精确匹配
    if source in source_texts:
        return source_texts[source]

    # 2. 尝试添加常见后缀进行匹配
    common_suffixes = ['经', '论']
    for suffix in common_suffixes:
        if not source.endswith(suffix):
            candidates = [source + suffix]
            # 也尝试"波罗蜜经"类
            if suffix == '经' and not source.endswith('波罗蜜'):
                candidates.append(source + '波罗蜜经')
            for cand in candidates:
                if cand in source_texts:
                    return source_texts[cand]

    # 3. 前缀匹配：source 是经书名的前缀
    for source_title, source_book in source_texts.items():
        if source_title.startswith(source) and len(source_title) - len(source) <= 6:
            # 经书名比source长不超过6个字符（通常是"波罗蜜"之类）
            return source_book

    # 4. 子串匹配：source 包含在经书名中，或经书名包含source
    best_match = None
    best_score = 0
    for source_title, source_book in source_texts.items():
        # 计算相似度分数
        if source in source_title:
            score = len(source) / len(source_title)  # 子串得分
        elif source_title in source:
            score = len(source_title) / len(source)  # 超串得分
        else:
            # 包含共同字符
            common = len(set(source) & set(source_title))
            if common >= 3:
                score = common / max(len(source), len(source_title))
            else:
                score = 0

        if score > best_score and score >= 0.5:  # 至少50%相似
            best_score = score
            best_match = source_book

    return best_match


def build_sutra_zhushu_mapping(all_books):
    """
    构建经书与注疏的对应关系
    返回: {
        '经典ID': {
            'title': '金刚经',
            'zhushus': [
                {'id': 'T33n1701', 'title': '金刚经疏', 'author': '...'},
                {'id': 'T33n1702', 'title': '金刚经述记', 'author': '...'},
            ]
        }
    }
    """
    # 收集所有经典（jing类）
    jing_books = {book['title']: book for book in all_books if book['text_type'] == 'jing'}
    lun_books = {book['title']: book for book in all_books if book['text_type'] == 'lun'}

    # 合并经典和论著，用于匹配
    source_texts = {}
    for title, book in jing_books.items():
        source_texts[title] = book
    for title, book in lun_books.items():
        source_texts[title] = book

    # 构建映射
    mapping = {}

    for book in all_books:
        if book['text_type'] != 'zhushu':
            continue

        source = extract_source_text(book['title'], book['text_type'])
        if not source:
            continue

        # 使用改进的模糊匹配
        matched_source = find_best_match(source, source_texts)

        if matched_source:
            source_id = matched_source['id']
            if source_id not in mapping:
                mapping[source_id] = {
                    'title': matched_source['title'],
                    'source_type': matched_source['text_type'],
                    'zhushus': []
                }
            mapping[source_id]['zhushus'].append({
                'id': book['id'],
                'title': book['title'],
                'author': book['author'],
                'suffix': book['suffix']
            })

    return mapping


def main():
    data_dir = Path('/home/guang/happy/yoho-cbeta/data-simplified')

    # 收集所有经书信息
    all_books = []
    print("正在扫描经书...")

    for json_file in data_dir.rglob('*.json'):
        info = extract_title_info(json_file)
        if info:
            text_type, suffix = get_text_type(info['title'])
            info['text_type'] = text_type
            info['suffix'] = suffix
            all_books.append(info)

    print(f"共找到 {len(all_books)} 部经书\n")

    # 按文本类型和标准化标题分组
    type_groups = defaultdict(lambda: defaultdict(list))

    for book in all_books:
        normalized = normalize_title_for_grouping(book['title'], book['text_type'])
        type_groups[book['text_type']][normalized].append(book)

    # 统计各类型数量
    print("文本类型统计:")
    print(f"- 经典(jing): {sum(len(g) for g in type_groups['jing'].values())}")
    print(f"- 论著(lun): {sum(len(g) for g in type_groups['lun'].values())}")
    print(f"- 注疏(zhushu): {sum(len(g) for g in type_groups['zhushu'].values())}")
    print(f"- 其他(other): {sum(len(g) for g in type_groups['other'].values())}")
    print(f"- 未知(unknown): {sum(len(g) for g in type_groups['unknown'].values())}")
    print()

    # 找出有多个版本的组
    multi_version_groups = {}

    for text_type, groups in type_groups.items():
        for norm_title, books in groups.items():
            if len(books) > 1:
                if text_type not in multi_version_groups:
                    multi_version_groups[text_type] = []
                multi_version_groups[text_type].append({
                    'norm_title': norm_title,
                    'books': books,
                    'count': len(books)
                })

    # 按版本数排序
    for text_type in multi_version_groups:
        multi_version_groups[text_type].sort(key=lambda x: x['count'], reverse=True)

    print(f"多版本组统计:")
    for text_type in multi_version_groups:
        print(f"- {text_type}: {len(multi_version_groups[text_type])} 组")
    print()

    # 构建JSON结果
    result = {}

    # 输出目录
    output_dir = Path('/home/guang/happy/yoho-cbeta/analysis')
    output_dir.mkdir(exist_ok=True)

    # 分配组ID：不同类型使用不同的ID范围
    group_counters = {
        'jing': 1000,      # 经典类从1000开始
        'lun': 2000,       # 论著类从2000开始
        'zhushu': 3000,    # 注疏类从3000开始
        'other': 4000,      # 其他类从4000开始
        'unknown': 0        # 未知类用0
    }

    # 处理多版本组
    for text_type in ['jing', 'lun', 'zhushu', 'other']:
        if text_type not in multi_version_groups:
            continue

        for group in multi_version_groups[text_type]:
            group_id = group_counters[text_type]
            group_counters[text_type] += 1

            for book in group['books']:
                result[book['id']] = {
                    'group_id': group_id,
                    'group_name': group['norm_title'],
                    'text_type': text_type,
                    'title': book['title'],
                    'author': book['author'],
                    'source': book['source']
                }

    # 添加单版本经书
    for book in all_books:
        if book['id'] not in result:
            if book['text_type'] == 'unknown':
                result[book['id']] = {
                    'group_id': 0,
                    'group_name': '',
                    'text_type': book['text_type'],
                    'title': book['title'],
                    'author': book['author'],
                    'source': book['source']
                }
            else:
                # 单版本的也有独立的组ID
                group_id = group_counters[book['text_type']]
                group_counters[book['text_type']] += 1

                result[book['id']] = {
                    'group_id': group_id,
                    'group_name': book['title'],
                    'text_type': book['text_type'],
                    'title': book['title'],
                    'author': book['author'],
                    'source': book['source']
                }

    # 保存为JSON文件
    output_file = output_dir / 'sutra_groups_v2.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"JSON文件已保存到: {output_file}")

    # ==================== 构建经书-注疏关联 ====================
    print("\n正在构建经书-注疏关联关系...")

    # 统计有多少注疏成功匹配到源经典
    zhushu_to_source = build_sutra_zhushu_mapping(all_books)

    total_zhushu_with_source = sum(len(v['zhushus']) for v in zhushu_to_source.values())
    total_zhushu = sum(len(g) for g in type_groups['zhushu'].values())
    print(f"注疏总数: {total_zhushu}")
    print(f"成功关联到源经典的注疏: {total_zhushu_with_source}")
    print(f"有注疏的经典数量: {len(zhushu_to_source)}")

    # 保存经书-注疏关联关系为JSON
    zhushu_mapping_file = output_dir / 'sutra_zhushu_mapping.json'
    with open(zhushu_mapping_file, 'w', encoding='utf-8') as f:
        json.dump(zhushu_to_source, f, ensure_ascii=False, indent=2)
    print(f"经书-注疏关联已保存到: {zhushu_mapping_file}")

    # ==================== 构建同经不同翻译版本关联 ====================
    print("\n正在构建同经不同翻译版本关联...")

    translation_groups = build_translation_groups(all_books)
    print(f"有多译本的经书组数: {len(translation_groups)}")

    # 保存翻译版本关联为JSON
    translation_mapping_file = output_dir / 'sutra_translations.json'
    with open(translation_mapping_file, 'w', encoding='utf-8') as f:
        json.dump(translation_groups, f, ensure_ascii=False, indent=2)
    print(f"同经异译关联已保存到: {translation_mapping_file}")

    # 生成注疏类汇总报告
    zhushu_report = output_dir / 'zhushu_summary.txt'
    with open(zhushu_report, 'w', encoding='utf-8') as f:
        f.write("注疏类经书汇总报告\n")
        f.write("=" * 80 + "\n\n")

        if 'zhushu' in multi_version_groups:
            f.write(f"注疏类多版本组数: {len(multi_version_groups['zhushu'])}\n\n")

            for group in sorted(multi_version_groups['zhushu'],
                           key=lambda x: x['norm_title']):
                f.write(f"【注疏】: {group['norm_title']}\n")
                f.write(f"【版本数】: {group['count']}\n")
                f.write(f"【版本列表】:\n")
                for book in sorted(group['books'], key=lambda x: x['id']):
                    f.write(f"  - ID: {book['id']:<15} 标题: {book['title']:<50} 作者: {book['author']}\n")
                f.write("\n")

        # 添加经书-注疏关联报告
        f.write("\n" + "=" * 80 + "\n")
        f.write("经书-注疏关联关系\n")
        f.write("=" * 80 + "\n\n")

        f.write(f"注疏总数: {total_zhushu}\n")
        f.write(f"成功关联到源经典的注疏: {total_zhushu_with_source}\n")
        f.write(f"有注疏的经典数量: {len(zhushu_to_source)}\n\n")

        # 按注疏数量排序
        sorted_sources = sorted(zhushu_to_source.items(),
                               key=lambda x: len(x[1]['zhushus']),
                               reverse=True)

        for source_id, data in sorted_sources[:100]:  # 只输出前100个
            f.write(f"【经典】: {data['title']} ({source_id})\n")
            f.write(f"【类型】: {data['source_type']}\n")
            f.write(f"【注疏数量】: {len(data['zhushus'])}\n")
            f.write(f"【注疏列表】:\n")
            for zhushu in sorted(data['zhushus'], key=lambda x: x['id']):
                f.write(f"  - ID: {zhushu['id']:<15} 标题: {zhushu['title']:<40} 作者: {zhushu['author']}\n")
            f.write("\n")

        if len(sorted_sources) > 100:
            f.write(f"\n... 还有 {len(sorted_sources) - 100} 部经典有注疏（只显示前100个）\n")

        # 添加同经不同翻译版本报告
        f.write("\n" + "=" * 80 + "\n")
        f.write("同经不同翻译版本关联\n")
        f.write("=" * 80 + "\n\n")

        f.write(f"有多译本的经书组数: {len(translation_groups)}\n\n")

        # 按译本数量排序
        sorted_translations = sorted(translation_groups.items(),
                                     key=lambda x: x[1]['total_versions'],
                                     reverse=True)

        for base_title, group in sorted_translations[:50]:
            f.write(f"【经典】: {base_title}\n")
            f.write(f"【译本数】: {group['total_versions']}\n")
            f.write(f"【译本列表】:\n")
            for t in group['translations']:
                f.write(f"  - ID: {t['id']:<15} 标题: {t['title']:<45} 译者: {t['author']}\n")
            f.write("\n")

        if len(sorted_translations) > 50:
            f.write(f"\n... 还有 {len(sorted_translations) - 50} 部经书有多个译本（只显示前50个）\n")

    print(f"注疏汇总报告已保存到: {zhushu_report}")

    # 生成完整的分组统计报告
    report_file = output_dir / 'sutra_groups_v2_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("CBETA 经书版本关联分析报告 (修正版)\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"扫描目录: {data_dir}\n")
        f.write(f"经书总数: {len(all_books)}\n\n")

        # 各类型统计
        for text_type in ['jing', 'lun', 'zhushu', 'other', 'unknown']:
            type_name = {
                'jing': '经典(jing)',
                'lun': '论著(lun)',
                'zhushu': '注疏(zhushu)',
                'other': '其他(other)',
                'unknown': '未知(unknown)'
            }[text_type]

            total = sum(len(g) for g in type_groups[text_type].values())
            multi_count = len(multi_version_groups.get(text_type, []))
            multi_books = sum(g['count'] for g in multi_version_groups.get(text_type, []))

            f.write(f"\n{type_name}:\n")
            f.write(f"  总数: {total}\n")
            f.write(f"  多版本组数: {multi_count}\n")
            f.write(f"  多版本经书数: {multi_books}\n")
            f.write(f"  单版本经书数: {total - multi_books}\n")

        # 详细的多版本列表
        f.write("\n" + "=" * 80 + "\n")
        f.write("多版本经书详细列表\n")
        f.write("=" * 80 + "\n\n")

        all_multi = []
        for text_type in multi_version_groups:
            for group in multi_version_groups[text_type]:
                all_multi.append({
                    'text_type': text_type,
                    'norm_title': group['norm_title'],
                    'count': group['count'],
                    'books': group['books']
                })

        # 按版本数排序
        all_multi.sort(key=lambda x: x['count'], reverse=True)

        for group in all_multi:
            type_mapping = {
                'jing': '经典',
                'lun': '论著',
                'zhushu': '注疏',
                'other': '其他',
                'unknown': '未知'
            }
            type_name = type_mapping.get(group['text_type'], group['text_type'])

            f.write(f"【{type_name}】: {group['norm_title']}\n")
            f.write(f"【版本数】: {group['count']}\n")
            f.write(f"【版本列表】:\n")
            for book in sorted(group['books'], key=lambda x: x['id']):
                f.write(f"  - ID: {book['id']:<15} 标题: {book['title']:<50} 作者: {book['author']}\n")
            f.write("\n")

    print(f"完整报告已保存到: {report_file}")


if __name__ == '__main__':
    main()
