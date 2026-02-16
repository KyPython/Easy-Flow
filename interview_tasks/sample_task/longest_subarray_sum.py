# interview_tasks/sample_task/longest_subarray_sum.py

def max_subarray_len(nums, k):
    # TODO: implement using prefix-sum + hashmap
    
    prefix_sum = 0
    sum_index_map = {0: -1}  # Initialize with sum 0 at index -1
    max_len = 0

    for i, num in enumerate(nums):
        prefix_sum += num
        if prefix_sum - k in sum_index_map:
            max_len = max(max_len, i - sum_index_map[prefix_sum - k])
        if prefix_sum not in sum_index_map:
            sum_index_map[prefix_sum] = i

    return max_len