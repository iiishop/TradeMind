/**
 * TradeMind Lite - 自选股导入功能
 * 
 * 本文件包含自选股导入功能的前端交互逻辑
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM元素
    const importModal = document.getElementById('importWatchlistModal');
    const successModal = document.getElementById('importSuccessModal');
    const luckyButton = document.getElementById('luckyButton');
    
    // 步骤1元素
    const stockInputForm = document.getElementById('stockInputForm');
    const marketSelect = document.getElementById('marketSelect');
    const stockInput = document.getElementById('stockInput');
    const stockFile = document.getElementById('stockFile');
    const fileImportBtn = document.getElementById('fileImportBtn');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const hasHeaderRow = document.getElementById('hasHeaderRow');
    const codeColumnIndex = document.getElementById('codeColumnIndex');
    const pasteFromClipboardBtn = document.getElementById('pasteFromClipboardBtn');
    const groupNameInput = document.getElementById('groupNameInput');
    const autoCategories = document.getElementById('autoCategories');
    const groupNameContainer = document.getElementById('groupNameContainer');
    const validateStocksBtn = document.getElementById('validateStocksBtn');
    const validateSpinner = document.getElementById('validateSpinner');
    const translateNames = document.getElementById('translateNames');
    
    // 步骤2元素
    const validationProgressBar = document.getElementById('validationProgressBar');
    const validationCurrentStatus = document.getElementById('validationCurrentStatus');
    const validationStats = document.getElementById('validationStats');
    const validCount = document.getElementById('validCount');
    const invalidCount = document.getElementById('invalidCount');
    const validationResultsTable = document.getElementById('validationResultsTable');
    const backToStep1Btn = document.getElementById('backToStep1Btn');
    const proceedToStep3Btn = document.getElementById('proceedToStep3Btn');
    const validStockCount = document.getElementById('validStockCount');
    
    // 步骤3元素
    const confirmGroupName = document.getElementById('confirmGroupName');
    const confirmValidCount = document.getElementById('confirmValidCount');
    const confirmInvalidCount = document.getElementById('confirmInvalidCount');
    const backToStep2Btn = document.getElementById('backToStep2Btn');
    const confirmImportBtn = document.getElementById('confirmImportBtn');
    const importSpinner = document.getElementById('importSpinner');
    
    // 成功模态框元素
    const importSuccessMessage = document.getElementById('importSuccessMessage');
    
    // 步骤标签
    const step1Tab = document.getElementById('step1-tab');
    const step2Tab = document.getElementById('step2-tab');
    const step3Tab = document.getElementById('step3-tab');
    
    // 存储验证结果
    let validationResults = [];
    
    // 初始化Bootstrap标签页
    const importStepsTabs = new bootstrap.Tab(step1Tab);
    
    // 初始化页面状态
    console.log('页面加载完成，初始化状态');
    
    // 确保验证按钮初始状态正确
    setTimeout(() => {
        console.log('检查验证按钮初始状态');
        
        // 如果自动分类已选中，确保分组名称输入框被禁用
        if (autoCategories && autoCategories.checked) {
            console.log('自动分类已选中，禁用分组名称输入');
            if (groupNameContainer) groupNameContainer.classList.add('d-none');
            if (groupNameInput) {
                groupNameInput.disabled = true;
                groupNameInput.value = '';
            }
        }
        
        // 检查验证按钮状态
        if (checkValidateButtonState) {
            checkValidateButtonState();
        }
    }, 100);
    
    // 更新进度条函数
    function updateProgressBar(current, total) {
        const percent = Math.min(Math.round((current / total) * 100), 100);
        
        // 更新自定义进度条
        const progressBar = document.querySelector('#validationProgressContainer .progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.setAttribute('aria-valuenow', percent);
            progressBar.textContent = `${percent}%`;
        }
        
        // 更新原始进度条
        if (validationProgressBar) {
            validationProgressBar.style.width = `${percent}%`;
            validationProgressBar.setAttribute('aria-valuenow', percent);
            validationProgressBar.textContent = `${percent}%`;
        }
    }
    
    // 从剪贴板粘贴
    pasteFromClipboardBtn.addEventListener('click', function() {
        navigator.clipboard.readText()
            .then(text => {
                stockInput.value = text;
            })
            .catch(err => {
                console.error('无法从剪贴板读取: ', err);
                alert('无法从剪贴板读取，请手动粘贴。');
            });
    });
    
    // 文件导入按钮点击事件
    if (fileImportBtn) {
        fileImportBtn.addEventListener('click', function() {
            console.log('文件导入按钮被点击');
            if (stockFile) {
                stockFile.click();
            } else {
                console.error('找不到文件输入元素');
            }
        });
    } else {
        console.error('找不到文件导入按钮元素');
    }
    
    // 文件选择变更事件
    stockFile.addEventListener('change', function(e) {
        if (!e.target.files.length) return;
        
        const file = e.target.files[0];
        
        // 更新文件名显示
        if (fileNameDisplay) {
            fileNameDisplay.value = file.name;
        }
        
        // 显示加载动画
        validateStocksBtn.disabled = true;
        validateSpinner.classList.remove('d-none');
        
        // 检查文件类型
        const fileName = file.name.toLowerCase();
        
        try {
            // 检查文件大小
            if (file.size > 5 * 1024 * 1024) { // 5MB
                throw new Error('文件过大，请上传小于5MB的文件');
            }
            
            console.log('开始处理文件:', fileName);
            
            // 根据文件类型处理
            if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
                readTextFile(file);
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                processExcelFile(file);
            } else {
                throw new Error('不支持的文件类型，请上传TXT、CSV或Excel文件');
            }
        } catch (error) {
            console.error('文件处理错误:', error);
            alert(`文件处理错误: ${error.message || '未知错误'}`);
            
            // 恢复按钮状态
            validateStocksBtn.disabled = false;
            validateSpinner.classList.add('d-none');
            
            // 清空文件输入
            stockFile.value = '';
            if (fileNameDisplay) {
                fileNameDisplay.value = '未选择文件';
            }
        }
    });
    
    // 股票输入框变更事件
    stockInput.addEventListener('input', function() {
        console.log('股票输入框内容变更');
        checkValidateButtonState();
    });
    
    // 读取文本文件
    function readTextFile(file) {
        try {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    parseFileContent(content);
                } catch (error) {
                    console.error('解析文本文件内容错误:', error);
                    alert(`解析文件内容错误: ${error.message || '未知错误'}`);
                    
                    // 恢复按钮状态
                    validateStocksBtn.disabled = false;
                    validateSpinner.classList.add('d-none');
                }
            };
            
            reader.onerror = function() {
                console.error('读取文件错误');
                alert('读取文件时发生错误，请重试');
                
                // 恢复按钮状态
                validateStocksBtn.disabled = false;
                validateSpinner.classList.add('d-none');
            };
            
            reader.readAsText(file);
        } catch (error) {
            console.error('读取文本文件错误:', error);
            alert(`读取文件错误: ${error.message || '未知错误'}`);
            
            // 恢复按钮状态
            validateStocksBtn.disabled = false;
            validateSpinner.classList.add('d-none');
        }
    }
    
    // 读取Excel文件
    function readExcelFile(file) {
        // 检查是否已加载XLSX库
        if (typeof XLSX === 'undefined') {
            // 动态加载XLSX库
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            script.onload = function() {
                processExcelFile(file);
            };
            script.onerror = function() {
                alert('加载Excel处理库失败，请检查网络连接');
            };
            document.head.appendChild(script);
        } else {
            processExcelFile(file);
        }
    }
    
    // 处理Excel文件
    function processExcelFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // 获取第一个工作表
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // 转换为CSV
                const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
                
                // 解析CSV内容
                parseFileContent(csvContent);
            } catch (error) {
                console.error('处理Excel文件出错:', error);
                alert('处理Excel文件出错: ' + error.message);
            }
        };
        
        reader.onerror = function() {
            alert('读取Excel文件失败');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    // 解析文件内容
    function parseFileContent(content) {
        try {
            console.log('开始解析文件内容');
            
            // 分割为行
            const lines = content.split('\n');
            
            // 如果有表头，跳过第一行
            const startIndex = hasHeaderRow.checked ? 1 : 0;
            
            // 获取代码列索引
            const colIndex = parseInt(codeColumnIndex.value) || 0;
            
            // 提取股票代码
            const codes = [];
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // 分割行（支持CSV格式）
                const columns = line.split(/,|;|\t/).map(col => col.trim());
                
                // 检查列索引是否有效
                if (colIndex < columns.length) {
                    const code = columns[colIndex].replace(/^["']|["']$/g, '').trim();
                    if (code) {
                        codes.push(code);
                    }
                }
            }
            
            console.log(`从文件中提取到 ${codes.length} 个股票代码`);
            
            if (codes.length === 0) {
                alert('未能从文件中提取到有效的股票代码');
                // 恢复按钮状态
                validateStocksBtn.disabled = false;
                validateSpinner.classList.add('d-none');
                return;
            }
            
            // 显示提取到的代码数量
            alert(`成功从文件中提取到 ${codes.length} 个股票代码`);
            
            // 将代码填入文本框，让用户可以编辑和确认
            stockInput.value = codes.join('\n');
            
            // 确保启用验证按钮
            validateSpinner.classList.add('d-none');
            
            // 强制检查验证按钮状态
            setTimeout(() => {
                console.log('文件解析完成，检查验证按钮状态');
                checkValidateButtonState();
                
                // 如果自动分类已选中，直接启用验证按钮
                if (autoCategories && autoCategories.checked) {
                    console.log('自动分类已选中，强制启用验证按钮');
                    validateStocksBtn.disabled = false;
                } else if (groupNameInput && groupNameInput.value.trim()) {
                    console.log('分组名称已填写，强制启用验证按钮');
                    validateStocksBtn.disabled = false;
                }
                
                console.log('验证按钮最终状态:', validateStocksBtn.disabled ? '禁用' : '启用');
            }, 100);
        } catch (error) {
            console.error('解析文件内容错误:', error);
            alert(`解析文件内容错误: ${error.message || '未知错误'}`);
            
            // 恢复按钮状态
            validateStocksBtn.disabled = false;
            validateSpinner.classList.add('d-none');
        }
    }
    
    // 自动分类复选框变更事件
    autoCategories.addEventListener('change', function() {
        console.log('自动分类选项变更:', this.checked);
        
        if (this.checked) {
            // 如果选中自动分类，禁用分组名称输入
            groupNameContainer.classList.add('d-none');
            groupNameInput.disabled = true;
            groupNameInput.value = ''; // 清空分组名称
            
            // 如果有股票代码，直接启用验证按钮
            if (stockInput.value.trim().length > 0) {
                console.log('自动分类选中且有股票代码，立即启用验证按钮');
                validateStocksBtn.disabled = false;
            }
            
            // 确保立即触发检查验证按钮状态
            setTimeout(() => {
                console.log('自动分类选中后立即检查验证按钮状态');
                checkValidateButtonState();
            }, 0);
        } else {
            // 如果取消自动分类，启用分组名称输入
            groupNameContainer.classList.remove('d-none');
            groupNameInput.disabled = false;
            groupNameInput.focus(); // 自动聚焦到分组名称输入框
            
            // 如果分组名称为空，禁用验证按钮
            if (!groupNameInput.value.trim()) {
                validateStocksBtn.disabled = true;
            }
        }
        
        // 更新步骤3的确认信息（如果已经显示）
        if (confirmGroupName) {
            confirmGroupName.textContent = this.checked ? '自动分类' : (groupNameInput.value.trim() || '未指定');
        }
        
        // 检查是否可以启用验证按钮
        checkValidateButtonState();
    });
    
    // 分组名称输入框变更事件
    groupNameInput.addEventListener('input', function() {
        console.log('分组名称变更:', this.value);
        
        // 更新步骤3的确认信息（如果已经显示）
        if (confirmGroupName) {
            confirmGroupName.textContent = this.value.trim() || '未指定';
        }
        
        // 检查是否可以启用验证按钮
        checkValidateButtonState();
    });
    
    // 检查验证按钮状态
    function checkValidateButtonState() {
        // 如果有股票代码输入，并且选择了自动分类或者输入了分组名称，则启用验证按钮
        const hasStockCodes = stockInput.value.trim().length > 0;
        const hasAutoCategories = autoCategories.checked;
        const hasGroupName = groupNameInput.value.trim().length > 0;
        
        // 修复逻辑：当选择了自动分类时，只需要检查是否有股票代码
        // 当未选择自动分类时，需要同时检查是否有股票代码和分组名称
        const shouldEnable = hasStockCodes && (hasAutoCategories || hasGroupName);
        
        console.log('验证按钮状态检查:', {
            hasStockCodes, 
            hasAutoCategories, 
            hasGroupName, 
            shouldEnable,
            currentDisabled: validateStocksBtn.disabled
        });
        
        // 强制更新按钮状态
        validateStocksBtn.disabled = !shouldEnable;
        
        // 如果应该启用但仍然禁用，尝试强制启用
        if (shouldEnable && validateStocksBtn.disabled) {
            console.log('强制启用验证按钮');
            setTimeout(() => {
                validateStocksBtn.disabled = false;
            }, 10);
        }
        
        return shouldEnable;
    }
    
    // 将函数暴露到全局，以便HTML中的函数可以调用
    window.checkValidateButtonState = checkValidateButtonState;
    
    // 验证股票代码
    validateStocksBtn.addEventListener('click', function() {
        console.log('验证按钮被点击');
        
        // 获取输入的股票代码
        if (!stockInput.value.trim()) {
            alert('请输入股票代码或上传文件');
            return;
        }
        
        // 检查是否选择了自动分类或者指定了分组名称
        const isAutoCategories = autoCategories.checked;
        const groupName = groupNameInput.value.trim();
        
        if (!isAutoCategories && !groupName) {
            alert('请选择自动分类或者指定分组名称');
            groupNameInput.focus();
            return;
        }
        
        // 禁用验证按钮，显示加载动画
        validateStocksBtn.disabled = true;
        validateSpinner.classList.remove('d-none');
        
        // 切换到验证结果标签页
        const step2TabEl = document.getElementById('step2-tab');
        if (step2TabEl) {
            step2TabEl.disabled = false;
            const step2Tab = new bootstrap.Tab(step2TabEl);
            step2Tab.show();
        }
        
        // 解析股票代码
        const stockCodes = stockInput.value.trim().split(/[\n,;]+/).map(code => code.trim()).filter(code => code);
        
        console.log(`开始验证 ${stockCodes.length} 个股票代码`);
        console.log('自动分类:', isAutoCategories);
        console.log('分组名称:', groupName);
        
        // 更新步骤3的确认信息
        if (confirmGroupName) {
            confirmGroupName.textContent = isAutoCategories ? '自动分类' : (groupName || '未指定');
        }
        
        // 初始化进度条
        validationProgressBar.style.width = '0%';
        validationProgressBar.setAttribute('aria-valuenow', 0);
        validationProgressBar.textContent = '0%';
        validationProgressBar.classList.add('progress-bar-animated');
        
        // 确保验证结果区域可见
        const validationResultsArea = document.querySelector('.validation-results');
        if (validationResultsArea) {
            validationResultsArea.classList.remove('d-none');
        }
        
        // 清空结果表格
        validationResultsTable.querySelector('tbody').innerHTML = '';
        
        // 更新验证状态文本
        if (validationCurrentStatus) {
            validationCurrentStatus.textContent = `正在验证 ${stockCodes.length} 个股票代码...`;
        }
        
        // 更新统计信息
        if (validationStats) {
            validationStats.textContent = `0/${stockCodes.length}`;
        }
        
        // 开始批量验证
        const cancelValidation = batchValidateStocks(stockCodes, groupName, isAutoCategories);
        
        // 返回按钮点击事件
        backToStep1Btn.addEventListener('click', function() {
            // 如果正在验证，取消验证
            if (cancelValidation) {
                cancelValidation();
            }
            
            // 切换回步骤1
            const step1TabEl = document.getElementById('step1-tab');
            if (step1TabEl) {
                const step1Tab = new bootstrap.Tab(step1TabEl);
                step1Tab.show();
            }
        });
    });
    
    // 开始验证流程
    function startValidation(stockCodes) {
        // 显示加载动画
        validateStocksBtn.disabled = true;
        validateSpinner.classList.remove('d-none');
        
        // 清空验证结果
        validationResults = [];
        validationResultsTable.innerHTML = '';
        
        // 获取验证结果区域
        const validationResultsSection = document.querySelector('.validation-results');
        if (validationResultsSection) {
            validationResultsSection.classList.remove('d-none');
        }
        
        // 移除之前的进度条和状态文本
        const existingProgressContainer = document.querySelector('#validationProgressContainer');
        const existingStatusText = document.querySelector('#validationStatusText');
        if (existingProgressContainer) existingProgressContainer.remove();
        if (existingStatusText) existingStatusText.remove();
        
        // 使用原始进度条，不创建新的
        if (validationProgressBar) {
            validationProgressBar.style.width = '0%';
            validationProgressBar.setAttribute('aria-valuenow', '0');
            validationProgressBar.textContent = '0%';
            validationProgressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
        }
        
        // 使用原始状态文本
        if (validationCurrentStatus) {
            validationCurrentStatus.textContent = '正在初始化验证...';
        }
        
        // 设置验证状态变量
        window.validationInProgress = true;
        
        // 启用步骤2标签页
        const step2Tab = document.getElementById('step2-tab');
        if (step2Tab) {
            step2Tab.disabled = false;
            // 切换到步骤2
            const step2TabInstance = new bootstrap.Tab(step2Tab);
            step2TabInstance.show();
        }
        
        // 添加初始加载动画，提高用户体验
        const loadingRow = document.createElement('tr');
        loadingRow.id = 'validation-loading-row';
        loadingRow.innerHTML = `
            <td colspan="4" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">正在验证股票代码，请稍候...</p>
            </td>
        `;
        validationResultsTable.appendChild(loadingRow);
        
        // 批量验证股票代码
        setTimeout(() => {
            batchValidateStocks(stockCodes, groupNameInput.value, autoCategories.checked);
        }, 100); // 短暂延迟，让UI先渲染
        
        // 监听模态框关闭事件，停止验证过程
        importModal.addEventListener('hide.bs.modal', function() {
            if (window.validationInProgress) {
                window.validationInProgress = false;
                // 调用取消验证API
                fetch('/api/cancel-validation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    console.log('验证过程已取消:', data);
                })
                .catch(error => {
                    console.error('取消验证出错:', error);
                });
            }
        });
        
        // 监听返回按钮点击事件
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', function() {
                if (window.validationInProgress) {
                    window.validationInProgress = false;
                    // 调用取消验证API
                    fetch('/api/cancel-validation', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log('验证过程已取消:', data);
                    })
                    .catch(error => {
                        console.error('取消验证出错:', error);
                    });
                }
            });
        });
    }
    
    // 批量验证股票代码
    function batchValidateStocks(codes, groupName, isAutoCategories) {
        // 重置验证结果
        validationResults = [];
        
        // 重置统计数据
        let validStocks = 0;
        let invalidStocks = 0;
        let processedCount = 0;
        
        // 获取翻译选项
        const shouldTranslate = translateNames && translateNames.checked;
        
        // 更新统计显示
        validCount.textContent = validStocks;
        invalidCount.textContent = invalidStocks;
        
        // 清空结果表格
        validationResultsTable.querySelector('tbody').innerHTML = '';
        
        // 显示进度条
        validationProgressBar.style.width = '0%';
        validationProgressBar.setAttribute('aria-valuenow', 0);
        validationProgressBar.textContent = '0%';
        validationProgressBar.classList.add('progress-bar-animated');
        
        // 分批处理，每批10个，减小批量大小以提高进度条准确性
        const batchSize = 10;
        const totalBatches = Math.ceil(codes.length / batchSize);
        let currentBatch = 0;
        let isCancelled = false;
        
        console.log(`开始批量验证 ${codes.length} 个股票代码，分为 ${totalBatches} 批处理`);
        console.log('翻译选项:', shouldTranslate);
        
        // 处理一批股票代码
        function processBatch(batchIndex) {
            if (isCancelled) {
                console.log('验证过程被取消');
                return;
            }
            
            const start = batchIndex * batchSize;
            const end = Math.min(start + batchSize, codes.length);
            const batchCodes = codes.slice(start, end);
            
            // 更新当前状态
            validationCurrentStatus.textContent = `正在验证第 ${start+1} 到 ${end} 个，共 ${codes.length} 个`;
            
            // 更新统计信息
            if (validationStats) {
                validationStats.textContent = `${processedCount}/${codes.length}`;
            }
            
            // 更新进度条 - 使用已处理的数量而不是当前批次的结束位置
            const percent = Math.min(Math.round((processedCount / codes.length) * 100), 100);
            validationProgressBar.style.width = `${percent}%`;
            validationProgressBar.setAttribute('aria-valuenow', percent);
            validationProgressBar.textContent = `${percent}%`;
            
            // 发送验证请求
            fetch('/api/validate-stocks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    codes: batchCodes,
                    translate: shouldTranslate
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`验证请求失败: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (isCancelled) return;
                
                // 更新已处理数量
                processedCount += batchCodes.length;
                
                // 更新进度条 - 在处理完当前批次后立即更新
                const newPercent = Math.min(Math.round((processedCount / codes.length) * 100), 100);
                validationProgressBar.style.width = `${newPercent}%`;
                validationProgressBar.setAttribute('aria-valuenow', newPercent);
                validationProgressBar.textContent = `${newPercent}%`;
                
                // 更新统计信息
                if (validationStats) {
                    validationStats.textContent = `${processedCount}/${codes.length}`;
                }
                
                // 处理验证结果
                for (const result of data.results) {
                    // 添加到结果数组
                    validationResults.push(result);
                    
                    // 更新统计数据
                    if (result.valid) {
                        validStocks++;
                    } else {
                        invalidStocks++;
                    }
                    
                    // 添加到表格
                    addResultToTable(result);
                }
                
                // 更新统计显示
                validCount.textContent = validStocks;
                invalidCount.textContent = invalidStocks;
                
                // 处理下一批
                currentBatch++;
                if (currentBatch < totalBatches) {
                    // 使用短延迟，让UI有时间更新
                    setTimeout(() => {
                        processBatch(currentBatch);
                    }, 50);
                } else {
                    // 全部处理完成
                    validationCurrentStatus.textContent = `验证完成，共 ${codes.length} 个股票代码`;
                    validationProgressBar.classList.remove('progress-bar-animated');
                    validationProgressBar.classList.add('bg-success');
                    validationProgressBar.style.width = '100%';
                    validationProgressBar.setAttribute('aria-valuenow', 100);
                    validationProgressBar.textContent = '100%';
                    
                    // 更新步骤3的确认信息
                    confirmValidCount.textContent = validStocks;
                    confirmInvalidCount.textContent = invalidStocks;
                    validStockCount.textContent = validStocks;
                    
                    // 如果有有效的股票，启用下一步按钮
                    if (validStocks > 0) {
                        proceedToStep3Btn.disabled = false;
                    } else {
                        proceedToStep3Btn.disabled = true;
                    }
                    
                    // 隐藏加载动画
                    validateSpinner.classList.add('d-none');
                }
            })
            .catch(error => {
                console.error('验证请求错误:', error);
                
                // 显示错误信息
                validationCurrentStatus.textContent = `验证过程中出错: ${error.message}`;
                validationProgressBar.classList.remove('progress-bar-animated');
                
                // 添加错误提示到表格
                const errorRow = document.createElement('tr');
                errorRow.classList.add('table-danger');
                errorRow.innerHTML = `
                    <td colspan="4" class="text-center">
                        <div class="alert alert-danger mb-0">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            验证过程中出错: ${error.message}
                        </div>
                    </td>
                `;
                validationResultsTable.querySelector('tbody').appendChild(errorRow);
                
                // 隐藏加载动画
                validateSpinner.classList.add('d-none');
            });
        }
        
        // 开始处理第一批
        processBatch(0);
        
        // 返回取消函数
        return function cancel() {
            isCancelled = true;
            validationCurrentStatus.textContent = '验证已取消';
            validateSpinner.classList.add('d-none');
        };
    }
    
    // 添加验证结果到表格
    function addResultToTable(result) {
        const tbody = document.querySelector('#validationResultsTable tbody');
        if (!tbody) {
            console.error('找不到验证结果表格的tbody元素');
            return;
        }
        
        const row = document.createElement('tr');
        
        // 股票代码列
        const codeCell = document.createElement('td');
        codeCell.textContent = result.code;
        if (result.yf_code) {
            const yfCodeSpan = document.createElement('span');
            yfCodeSpan.className = 'ms-2 badge bg-secondary';
            yfCodeSpan.textContent = `YF: ${result.yf_code}`;
            codeCell.appendChild(yfCodeSpan);
        }
        row.appendChild(codeCell);
        
        // 名称列
        const nameCell = document.createElement('td');
        if (result.valid) {
            nameCell.textContent = result.name || '';
        } else {
            // 对于无效的股票，显示错误信息
            const errorBadge = document.createElement('span');
            errorBadge.className = 'badge bg-danger';
            errorBadge.textContent = '无效';
            nameCell.appendChild(errorBadge);
        }
        row.appendChild(nameCell);
        
        // 价格列
        const priceCell = document.createElement('td');
        if (result.valid && result.price) {
            priceCell.textContent = `${result.price} ${result.currency || 'USD'}`;
        } else {
            priceCell.textContent = '-';
        }
        row.appendChild(priceCell);
        
        // 状态列
        const statusCell = document.createElement('td');
        if (result.valid) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-success';
            badge.textContent = '有效';
            statusCell.appendChild(badge);
            
            // 显示市场类型
            if (result.market_type) {
                const marketBadge = document.createElement('span');
                marketBadge.className = 'ms-2 badge bg-info';
                
                // 翻译市场类型
                let marketType = result.market_type;
                if (marketType === 'equity') marketType = '股票';
                else if (marketType === 'etf') marketType = 'ETF';
                else if (marketType === 'index') marketType = '指数';
                
                marketBadge.textContent = marketType;
                statusCell.appendChild(marketBadge);
            }
        } else {
            // 创建一个警告框来显示错误信息
            const errorBox = document.createElement('div');
            errorBox.className = 'alert alert-warning py-1 px-2 mb-0';
            errorBox.style.fontSize = '0.8rem';
            
            // 处理特定类型的错误，提供更友好的提示
            let errorMessage = result.error || '未知错误';
            
            // 检查是否为期货合约错误
            if (errorMessage.includes('期货合约') || errorMessage.includes('期货') || /[A-Z]{2}\d{4}/.test(result.code)) {
                errorBox.className = 'alert alert-danger py-1 px-2 mb-0';
                if (/[A-Z]{2}\d{4}/.test(result.code)) {
                    errorMessage = `不支持期货合约代码 ${result.code}，请使用普通股票代码`;
                }
            }
            // 检查是否为404错误
            else if (errorMessage.includes('404') || errorMessage.includes('无法识别')) {
                errorBox.className = 'alert alert-danger py-1 px-2 mb-0';
            }
            
            errorBox.textContent = errorMessage;
            statusCell.appendChild(errorBox);
        }
        row.appendChild(statusCell);
        
        // 添加到表格
        tbody.appendChild(row);
        
        // 更新统计数据
        updateValidationStats();
    }
    
    // 更新验证统计数据
    function updateValidationStats() {
        const validStocksCount = validationResults.filter(r => r.valid).length;
        const invalidStocksCount = validationResults.length - validStocksCount;
        
        // 更新统计显示
        if (validCount) validCount.textContent = validStocksCount;
        if (invalidCount) invalidCount.textContent = invalidStocksCount;
        if (validStockCount) validStockCount.textContent = `(${validStocksCount})`;
    }
    
    // 返回步骤1
    backToStep1Btn.addEventListener('click', function() {
        const step1TabInstance = new bootstrap.Tab(step1Tab);
        step1TabInstance.show();
    });
    
    // 进入步骤3
    proceedToStep3Btn.addEventListener('click', function() {
        // 检查是否选择了自动分类或者指定了分组名称
        const isAutoCategories = autoCategories.checked;
        const groupName = groupNameInput.value.trim();
        
        if (!isAutoCategories && !groupName) {
            alert('请选择自动分类或者指定分组名称');
            // 切换回步骤1以便用户设置分组
            const step1TabInstance = new bootstrap.Tab(step1Tab);
            step1TabInstance.show();
            groupNameInput.focus();
            return;
        }
        
        // 启用步骤3标签页
        step3Tab.disabled = false;
        
        // 切换到步骤3
        const step3TabInstance = new bootstrap.Tab(step3Tab);
        step3TabInstance.show();
        
        // 更新确认信息
        if (confirmGroupName) {
            confirmGroupName.textContent = isAutoCategories ? '自动分类' : groupName;
        }
    });
    
    // 返回步骤2
    backToStep2Btn.addEventListener('click', function() {
        const step2TabInstance = new bootstrap.Tab(step2Tab);
        step2TabInstance.show();
    });
    
    // 确认导入按钮点击事件
    confirmImportBtn.addEventListener('click', function() {
        // 禁用按钮，显示加载动画
        confirmImportBtn.disabled = true;
        importSpinner.classList.remove('d-none');
        
        // 获取分组名称和自动分类选项
        const isAutoCategories = autoCategories && autoCategories.checked;
        const groupNameValue = groupNameInput ? groupNameInput.value.trim() : '';
        
        // 获取有效的股票
        const validStocks = validationResults.filter(r => r.valid);
        
        // 获取是否清空现有列表
        const clearExisting = document.getElementById('clearExistingStocks') && document.getElementById('clearExistingStocks').checked;
        
        // 如果选择清空现有列表，显示确认对话框
        if (clearExisting) {
            // 使用Bootstrap确认对话框
            const confirmDialog = `
                <div class="modal fade" id="importConfirmDialog" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">确认操作</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="alert alert-warning">
                                    <i class="bi bi-exclamation-triangle-fill"></i>
                                    <strong>即将清空现有列表并导入新自选股列表（推荐这么做）</strong>
                                </div>
                                <p>这将删除所有现有的股票分组和股票，并导入新的自选股列表。</p>
                                <p>如果您不希望清空现有列表，请点击"取消"并取消勾选"清空现有列表"选项。</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="cancelImportBtn">取消</button>
                                <button type="button" class="btn btn-primary" id="proceedImportBtn">继续导入</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加对话框到页面
            const dialogContainer = document.createElement('div');
            dialogContainer.innerHTML = confirmDialog;
            document.body.appendChild(dialogContainer);
            
            // 显示对话框
            const confirmDialogEl = document.getElementById('importConfirmDialog');
            const confirmDialogModal = new bootstrap.Modal(confirmDialogEl);
            confirmDialogModal.show();
            
            // 取消按钮点击事件
            document.getElementById('cancelImportBtn').addEventListener('click', function() {
                // 恢复按钮状态
                confirmImportBtn.disabled = false;
                importSpinner.classList.add('d-none');
                
                // 关闭对话框
                confirmDialogModal.hide();
                
                // 移除对话框
                setTimeout(() => {
                    document.body.removeChild(dialogContainer);
                }, 500);
            });
            
            // 确认按钮点击事件
            document.getElementById('proceedImportBtn').addEventListener('click', function() {
                // 关闭对话框
                confirmDialogModal.hide();
                
                // 移除对话框
                setTimeout(() => {
                    document.body.removeChild(dialogContainer);
                }, 500);
                
                // 执行导入
                performImport(validStocks, isAutoCategories, groupNameValue, clearExisting);
            });
            
            // 对话框关闭事件
            confirmDialogEl.addEventListener('hidden.bs.modal', function() {
                // 恢复按钮状态
                confirmImportBtn.disabled = false;
                importSpinner.classList.add('d-none');
            });
        } else {
            // 直接执行导入
            performImport(validStocks, isAutoCategories, groupNameValue, clearExisting);
        }
    });
    
    // 执行导入操作
    function performImport(validStocks, isAutoCategories, groupNameValue, clearExisting) {
        // 禁用按钮，显示加载动画
        confirmImportBtn.disabled = true;
        importSpinner.classList.remove('d-none');
        
        // 发送请求导入自选股
        fetch('/api/import-watchlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stocks: validStocks,
                groupName: isAutoCategories ? '' : groupNameValue,
                autoCategories: isAutoCategories,
                clearExisting: clearExisting
            })
        })
        .then(response => response.json())
        .then(data => {
            if (confirmImportBtn) confirmImportBtn.disabled = false;
            if (importSpinner) importSpinner.classList.add('d-none');
            
            if (data.success) {
                // 关闭导入模态框
                if (importModal) {
                    const importModalInstance = bootstrap.Modal.getInstance(importModal);
                    if (importModalInstance) importModalInstance.hide();
                }
                
                // 显示成功消息
                if (importSuccessMessage) {
                    importSuccessMessage.textContent = data.message;
                }
                
                // 显示成功模态框
                if (successModal) {
                    const successModalInstance = new bootstrap.Modal(successModal);
                    successModalInstance.show();
                }
                
                // 重置表单
                resetImportForm();
                
                // 刷新观察列表下拉菜单
                refreshWatchlistDropdown(data.watchlists);
            } else {
                // 显示友好的错误消息
                const errorMsg = data.error || '未知错误';
                console.error('导入自选股失败:', errorMsg);
                
                // 使用更友好的错误提示
                const errorAlert = document.createElement('div');
                errorAlert.className = 'alert alert-danger mt-3';
                errorAlert.innerHTML = `
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    导入失败: ${errorMsg}
                `;
                
                // 添加到确认区域
                const confirmArea = document.querySelector('.step-3-content');
                if (confirmArea) {
                    // 移除之前的错误提示
                    const previousError = confirmArea.querySelector('.alert-danger');
                    if (previousError) previousError.remove();
                    
                    confirmArea.appendChild(errorAlert);
                } else {
                    // 如果找不到确认区域，使用alert
                    alert('导入自选股失败: ' + errorMsg);
                }
            }
        })
        .catch(error => {
            console.error('导入自选股出错:', error);
            
            // 恢复按钮状态
            if (confirmImportBtn) confirmImportBtn.disabled = false;
            if (importSpinner) importSpinner.classList.add('d-none');
            
            // 使用更友好的错误提示
            const errorAlert = document.createElement('div');
            errorAlert.className = 'alert alert-danger mt-3';
            errorAlert.innerHTML = `
                <i class="bi bi-x-circle-fill me-2"></i>
                导入过程中出现错误，请稍后重试
            `;
            
            // 添加到确认区域
            const confirmArea = document.querySelector('.step-3-content');
            if (confirmArea) {
                // 移除之前的错误提示
                const previousError = confirmArea.querySelector('.alert-danger');
                if (previousError) previousError.remove();
                
                confirmArea.appendChild(errorAlert);
            } else {
                // 如果找不到确认区域，使用alert
                alert('导入自选股出错，请稍后重试');
            }
        });
    }
    
    // 刷新观察列表下拉菜单
    function refreshWatchlistDropdown(watchlists) {
        console.log('刷新观察列表下拉菜单', watchlists);
        
        // 刷新模态框内的下拉菜单（如果有的话）
        const modalWatchlistSelect = document.querySelector('#importWatchlistModal select[id="watchlist"]');
        if (modalWatchlistSelect) {
            updateSelectOptions(modalWatchlistSelect, watchlists);
        }
        
        // 刷新主页面的下拉菜单
        const mainWatchlistSelect = document.getElementById('watchlist');
        if (mainWatchlistSelect) {
            updateSelectOptions(mainWatchlistSelect, watchlists);
        } else {
            console.error('找不到主页面观察列表下拉菜单');
        }
    }
    
    // 更新下拉菜单选项
    function updateSelectOptions(selectElement, watchlists) {
        if (!selectElement) return;
        
        // 保存当前选中的值
        const selectedValue = selectElement.value;
        
        // 清空下拉菜单，只保留第一个选项
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }
        
        // 添加新的选项
        for (const groupName in watchlists) {
            const option = document.createElement('option');
            option.value = groupName;
            option.textContent = `${groupName} (${Object.keys(watchlists[groupName]).length}个股票)`;
            selectElement.appendChild(option);
        }
        
        // 恢复之前选中的值，如果它仍然存在
        if (selectedValue && Array.from(selectElement.options).some(opt => opt.value === selectedValue)) {
            selectElement.value = selectedValue;
        }
    }
    
    // 重置导入表单
    function resetImportForm() {
        // 重置步骤显示
        const steps = document.querySelectorAll('.import-step');
        if (steps && steps.length) {
            steps.forEach(step => {
                if (step.classList.contains('step-1')) {
                    step.classList.remove('d-none');
                } else {
                    step.classList.add('d-none');
                }
            });
        }
        
        // 重置输入框
        if (stockInput) stockInput.value = '';
        if (groupNameInput) groupNameInput.value = '';
        
        // 重置自动分类选项
        if (autoCategories) autoCategories.checked = false;
        if (groupNameContainer) groupNameContainer.classList.remove('d-none');
        
        // 重置验证结果
        validationResults = [];
        
        // 清空验证结果表格
        if (validationResultsTable) {
            const tbody = validationResultsTable.querySelector('tbody');
            if (tbody) tbody.innerHTML = '';
        }
        
        // 重置进度条
        if (validationProgressBar) {
            validationProgressBar.style.width = '0%';
            validationProgressBar.setAttribute('aria-valuenow', '0');
        }
        
        // 重置状态文本
        if (validationCurrentStatus) validationCurrentStatus.textContent = '';
        
        // 隐藏验证结果区域
        const validationResultsArea = document.querySelector('.validation-results');
        if (validationResultsArea) validationResultsArea.classList.add('d-none');
        
        // 重置按钮状态
        if (validateStocksBtn) {
            validateStocksBtn.disabled = false;
            validateStocksBtn.textContent = '验证股票代码';
        }
        
        if (validateSpinner) validateSpinner.classList.add('d-none');
        
        // 重置文件上传
        if (stockFile) stockFile.value = '';
        
        // 移除文件名显示
        if (fileNameDisplay) {
            fileNameDisplay.value = '未选择文件';
        }
        
        // 重置导入确认按钮
        if (confirmImportBtn) confirmImportBtn.disabled = false;
        if (importSpinner) importSpinner.classList.add('d-none');
        
        // 重置统计信息
        if (validCount) validCount.textContent = '0 有效';
        if (invalidCount) invalidCount.textContent = '0 无效';
        if (validStockCount) validStockCount.textContent = '(0)';
        
        // 移除任何错误提示
        const errorAlerts = document.querySelectorAll('.alert-danger');
        if (errorAlerts && errorAlerts.length) {
            errorAlerts.forEach(alert => alert.remove());
        }
        
        console.log('导入表单已重置');
    }
    
    // 导入模态框关闭时重置表单
    importModal.addEventListener('hidden.bs.modal', function() {
        resetImportForm();
    });

    // "手气不错"功能 - 自动整理自选股列表
    luckyButton.addEventListener('click', function() {
        // 显示加载状态
        luckyButton.disabled = true;
        luckyButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 正在整理...';
        
        // 显示进度区域
        const progressContainer = document.getElementById('luckyProgressContainer');
        const progressBar = document.getElementById('luckyProgressBar');
        const statusText = document.getElementById('luckyStatusText');
        progressContainer.classList.remove('d-none');
        
        // 设置初始进度
        updateLuckyProgress(5, '正在读取自选股列表...');
        
        // 设置进度轮询
        let progressInterval = setInterval(function() {
            fetch('/api/auto-organize-progress')
                .then(response => response.json())
                .then(data => {
                    if (data.in_progress) {
                        updateLuckyProgress(data.percent, data.status);
                    } else if (data.completed) {
                        // 停止轮询
                        clearInterval(progressInterval);
                        
                        // 设置为100%
                        updateLuckyProgress(100, '整理完成！');
                    }
                })
                .catch(error => {
                    console.error('获取进度失败:', error);
                });
        }, 1000);
        
        // 发送请求到后端
        fetch('/api/auto-organize-watchlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            // 停止进度轮询
            clearInterval(progressInterval);
            
            // 恢复按钮状态
            luckyButton.disabled = false;
            luckyButton.innerHTML = '<i class="bi bi-magic"></i> 手气不错 - 自动整理自选股列表';
            
            // 隐藏进度区域
            progressContainer.classList.add('d-none');
            
            if (data.success) {
                // 关闭导入模态框
                const importModalInstance = bootstrap.Modal.getInstance(importModal);
                importModalInstance.hide();
                
                // 显示成功消息
                importSuccessMessage.innerHTML = `
                    <p>${data.message}</p>
                    <div class="alert alert-success">
                        <ul>
                            <li>整理分组: ${data.stats.groups}个</li>
                            <li>验证股票: ${data.stats.stocks}个</li>
                            <li>翻译名称: ${data.stats.translated}个</li>
                            <li>修复无效: ${data.stats.fixed}个</li>
                        </ul>
                    </div>
                `;
                
                // 显示成功模态框
                const successModalInstance = new bootstrap.Modal(successModal);
                successModalInstance.show();
                
                // 刷新观察列表下拉菜单
                refreshWatchlistDropdown(data.watchlists);
            } else {
                alert('自动整理自选股列表失败: ' + data.error);
            }
        })
        .catch(error => {
            // 停止进度轮询
            clearInterval(progressInterval);
            
            // 隐藏进度区域
            progressContainer.classList.add('d-none');
            
            console.error('自动整理自选股列表出错:', error);
            alert('自动整理自选股列表出错: ' + error.message);
            luckyButton.disabled = false;
            luckyButton.innerHTML = '<i class="bi bi-magic"></i> 手气不错 - 自动整理自选股列表';
        });
    });
    
    // 更新"手气不错"进度条
    function updateLuckyProgress(percent, status) {
        const progressBar = document.getElementById('luckyProgressBar');
        const statusText = document.getElementById('luckyStatusText');
        const animatedText = document.getElementById('luckyAnimatedText');
        
        // 更新进度条
        percent = Math.min(Math.round(percent), 100);
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
        progressBar.textContent = `${percent}%`;
        
        // 更新状态文本
        statusText.textContent = status;
        
        // 根据进度阶段更新样式和提示信息
        if (percent >= 100) {
            progressBar.classList.remove('progress-bar-animated');
            progressBar.classList.add('bg-success');
            statusText.classList.remove('alert-info');
            statusText.classList.add('alert-success');
            statusText.textContent = '整理完成！所有股票已成功分类并保存。';
            
            // 隐藏动画文本
            animatedText.classList.add('d-none');
        } else if (percent >= 85) {
            statusText.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> 验证完成！正在写入文件并更新配置...';
            updateAnimatedText('即将完成，正在保存结果...');
        } else if (percent >= 65) {
            statusText.innerHTML = '<i class="bi bi-diagram-3-fill me-1"></i> 正在智能分类股票到不同分组...';
            updateAnimatedText('正在对股票进行智能分类，这需要一点时间...');
        } else if (percent >= 40) {
            // 为验证阶段添加更多变化的提示
            const verifyMessages = [
                '正在验证股票代码有效性...',
                '正在查询股票信息和最新数据...',
                '正在翻译股票名称为中文...',
                '正在修复无效的股票代码...',
                '正在处理特殊格式的股票代码...'
            ];
            
            // 根据进度选择不同的消息
            const messageIndex = Math.floor((percent - 20) / 5) % verifyMessages.length;
            statusText.innerHTML = `<i class="bi bi-search me-1"></i> ${verifyMessages[messageIndex]}`;
            
            // 添加动态效果
            updateAnimatedText('正在处理数据，请不要关闭窗口...');
        } else if (percent >= 20) {
            statusText.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> 正在批量验证股票代码，这可能需要一点时间...';
            updateAnimatedText('系统正在验证每个股票代码，请耐心等待...');
        } else if (percent >= 10) {
            statusText.innerHTML = '<i class="bi bi-file-earmark-text me-1"></i> 正在读取和解析股票数据...';
            updateAnimatedText('正在读取数据，请稍候...');
        } else {
            statusText.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> 正在初始化整理过程...';
            updateAnimatedText('系统正在准备中...');
        }
    }
    
    // 更新动画文本
    function updateAnimatedText(message) {
        const animatedText = document.getElementById('luckyAnimatedText');
        if (!animatedText) return;
        
        // 显示动画文本
        animatedText.classList.remove('d-none');
        
        // 更新文本内容
        const textSpan = animatedText.querySelector('span');
        if (textSpan) {
            textSpan.textContent = message;
        }
        
        // 随机改变动画颜色
        const spinners = animatedText.querySelectorAll('.spinner-grow');
        const colors = ['text-info', 'text-success', 'text-primary', 'text-warning'];
        
        spinners.forEach(spinner => {
            // 移除所有颜色类
            colors.forEach(color => {
                spinner.classList.remove(color);
            });
            
            // 添加随机颜色
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            spinner.classList.add(randomColor);
        });
    }

    // 初始化验证按钮状态
    console.log('初始化验证按钮状态');
    if (validateStocksBtn) {
        // 默认禁用验证按钮，直到有股票代码输入并选择了分类方式
        validateStocksBtn.disabled = true;
        
        // 检查初始状态
        setTimeout(() => {
            console.log('延迟检查验证按钮状态');
            checkValidateButtonState();
            
            // 如果自动分类已选中，确保分组名称输入框被禁用
            if (autoCategories && autoCategories.checked) {
                console.log('自动分类已选中，禁用分组名称输入框');
                if (groupNameContainer) groupNameContainer.classList.add('d-none');
                if (groupNameInput) {
                    groupNameInput.disabled = true;
                    groupNameInput.value = '';
                }
                
                // 如果有股票代码，启用验证按钮
                if (stockInput && stockInput.value.trim().length > 0) {
                    console.log('有股票代码，启用验证按钮');
                    validateStocksBtn.disabled = false;
                }
            }
        }, 100);
    } else {
        console.error('找不到验证按钮元素');
    }
}); 