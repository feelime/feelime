# -*- coding: utf-8 -*-
"""codex 审校补样（68 条，按四元组）。

取舍记录：
- 幺幺零：幺 不在候选字符集（解析器未认），跳过，落地时若解析器加幺 再收
- 零下五度：补「零」段 K（零下 的零不转）
- 星期/农历/正月初：保留汉字（口语固定说法，数字化反而不自然）
"""

NEW_PAIRS = [
    # age：年龄
    ("孩子今年三岁", "三", "age", "C"),
    ("爷爷已经七十六岁了", "七十六", "age", "C"),
    ("宝宝刚满十八个月", "十八", "age", "C"),
    ("小朋友也就两三岁", "两三", "age", "K"),
    # fraction：分数
    ("还剩三分之一的电量", "三分之一", "fraction", "C"),
    ("我只吃了四分之一个西瓜", "四分之一", "fraction", "C"),
    ("这个数再加二分之一", "二分之一", "fraction", "C"),
    ("完成了五分之四的任务", "五分之四", "fraction", "C"),
    # ratio-rate：比例
    ("盐和水按一比十混合", "一比十", "ratio-rate", "C"),
    ("男女比例是三比二", "三比二", "ratio-rate", "C"),
    ("手续费是千分之三", "千分之三", "ratio-rate", "C"),
    ("误差控制在万分之五以内", "万分之五", "ratio-rate", "C"),
    # multiple：倍数
    ("把图片放大三倍", "三", "multiple", "C"),
    ("用一点五倍速播放", "一点五", "multiple", "C"),
    ("容量增加到原来的两倍", "两", "multiple", "C"),
    ("这是二倍体细胞", "二", "multiple", "K"),
    # address-room：楼层门牌前导零
    ("快递送到十八楼", "十八", "address-room", "C"),
    ("房间号是零八零六", "零八零六", "address-room", "C"),
    ("我在三单元门口等你", "三", "address-room", "C"),
    ("停车场在地下二层", "二", "address-room", "C"),
    # identifier-tail：卡号尾号/取件码
    ("银行卡尾号是零零七八", "零零七八", "identifier-tail", "C"),
    ("取件码是零三六八", "零三六八", "identifier-tail", "C"),
    ("订单尾号四五六七", "四五六七", "identifier-tail", "C"),
    ("验证码是六零二九一八", "六零二九一八", "identifier-tail", "C"),
    # phone-digits：逐位号码
    ("请拨打一零零八六", "一零零八六", "phone-digits", "C"),
    ("电话分机是零二三", "零二三", "phone-digits", "C"),
    ("我的短号是一二三四五", "一二三四五", "phone-digits", "C"),
    # vehicle-plate：车牌（示例号）
    ("车牌是京A零零七八六", "零零七八六", "vehicle-plate", "C"),
    ("车牌是粤B三二零八九", "三二零八九", "vehicle-plate", "C"),
    ("车牌是沪C五六零一二", "五六零一二", "vehicle-plate", "C"),
    ("车牌是川A八六二零五", "八六二零五", "vehicle-plate", "C"),
    # body-size：身高体重
    ("我身高一百七十五厘米", "一百七十五", "body-size", "C"),
    ("她身高一米六八", "一米六八", "body-size", "C"),
    ("体重六十二点五公斤", "六十二点五", "body-size", "C"),
    ("宝宝重七斤半", "七斤半", "body-size", "C"),
    # match-score：比分
    ("我们二比一获胜", "二比一", "match-score", "C"),
    ("上半场零比零", "零比零", "match-score", "C"),
    ("最终比分是一百零二比九十八", "一百零二比九十八", "match-score", "C"),
    ("点球大战五比四结束", "五比四", "match-score", "C"),
    # temperature：温度
    ("今天最低气温零下五度", "五", "temperature", "C"),
    ("今天最低气温零下五度", "零", "temperature", "K"),
    ("现在室温二十三度", "二十三", "temperature", "C"),
    ("体温是三十七点八度", "三十七点八", "temperature", "C"),
    ("温差只有零点六度", "零点六", "temperature", "C"),
    # discount-share：折扣成数
    ("这件衣服打八折", "八", "discount-share", "C"),
    ("会员享受八点五折", "八点五", "discount-share", "C"),
    ("现在可以便宜三成", "三", "discount-share", "C"),
    ("先付两成定金", "两", "discount-share", "C"),
    # clock-detail：完整钟点
    ("末班车二十三点四十五分发车", "二十三点四十五", "clock-detail", "C"),
    ("闹钟定在七点零五分", "七点零五", "clock-detail", "C"),
    ("我们九点半集合", "九点", "clock-detail", "C"),
    ("下午三点一刻开始检票", "三点", "clock-detail", "C"),
    # approx-boundary：概数边界
    ("门口站着三四个人", "三四", "approx-boundary", "K"),
    ("我还得等十几分钟", "十", "approx-boundary", "K"),
    ("活动来了上千人", "千", "approx-boundary", "K"),
    ("这本书有三百多页", "三百", "approx-boundary", "C"),
    # calendar-traditional：星期农历
    ("我们星期三见", "三", "calendar-traditional", "K"),
    ("周六下午来我家", "六", "calendar-traditional", "K"),
    ("农历八月十五去赏月", "十五", "calendar-traditional", "K"),
    ("正月初一去拜年", "一", "calendar-traditional", "K"),
    # money-ellipsis：省略读法 + 二百五歧义
    ("每月房租一千二", "一千二", "money-ellipsis", "C"),
    ("电动车买来三千五", "三千五", "money-ellipsis", "C"),
    ("这件外套二百五", "二百五", "money-ellipsis", "C"),
    ("别把我当二百五", "二百五", "money-ellipsis", "K"),
    # spoken-action：动词重叠虚指
    ("你看一看再决定", "一", "spoken-action", "K"),
    ("帮我试一下", "一", "spoken-action", "K"),
    ("我们聊一聊", "一", "spoken-action", "K"),
    ("先休息一会儿", "一", "spoken-action", "K"),
]
